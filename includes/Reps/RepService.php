<?php
/**
 * Rep account management.
 *
 * @package ContactSync
 */

namespace ContactSync\Reps;

use ContactSync\Agencies\AgencyRepository;
use ContactSync\Portal\Router;
use ContactSync\Roles;
use ContactSync\Support\Db;
use ContactSync\Support\Mailer;
use WP_Error;
use WP_User;

defined( 'ABSPATH' ) || exit;

/**
 * Registration, verification, invitations and profile data for reps.
 */
class RepService {

	const STATUS_PENDING  = 'pending';
	const STATUS_ACTIVE   = 'active';
	const STATUS_DISABLED = 'disabled';

	const VERIFY_TTL = 2 * DAY_IN_SECONDS;

	/**
	 * Agencies.
	 *
	 * @var AgencyRepository
	 */
	private $agencies;

	/**
	 * Constructor.
	 *
	 * @param AgencyRepository|null $agencies Agency repository.
	 */
	public function __construct( ?AgencyRepository $agencies = null ) {
		$this->agencies = $agencies ? $agencies : new AgencyRepository();
	}

	/**
	 * Account status of a user. Users without the meta are treated as active.
	 *
	 * @param int $user_id User ID.
	 * @return string
	 */
	public static function status( $user_id ) {
		$status = get_user_meta( $user_id, 'cs_status', true );
		return $status ? $status : self::STATUS_ACTIVE;
	}

	/**
	 * Agency ID of a user, or null for independent reps.
	 *
	 * @param int $user_id User ID.
	 * @return int|null
	 */
	public static function agency_id( $user_id ) {
		$id = (int) get_user_meta( $user_id, 'cs_agency_id', true );
		return $id > 0 ? $id : null;
	}

	/**
	 * Whether the user belongs to an agency an administrator has disabled.
	 *
	 * @param int $user_id User ID.
	 * @return bool
	 */
	public static function agency_disabled( $user_id ) {
		$agency_id = self::agency_id( $user_id );
		return $agency_id && 'inactive' === AgencyRepository::status( $agency_id );
	}

	/**
	 * Sign out every member of an agency.
	 *
	 * @param int $agency_id Agency ID.
	 * @return int Users signed out.
	 */
	public static function sign_out_agency( $agency_id ) {
		$ids = get_users(
			array(
				'fields'     => 'ID',
				'meta_key'   => 'cs_agency_id', // phpcs:ignore WordPress.DB.SlowDBQuery.slow_query_meta_key
				'meta_value' => (int) $agency_id, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_query_meta_value
			)
		);
		foreach ( $ids as $id ) {
			if ( Roles::is_portal_user( (int) $id ) ) {
				\WP_Session_Tokens::get_instance( (int) $id )->destroy_all();
			}
		}
		return count( $ids );
	}

	/**
	 * Public profile used by the portal and admin.
	 *
	 * @param WP_User|int $user User.
	 * @return array|null
	 */
	public function profile( $user ) {
		$user = $user instanceof WP_User ? $user : get_userdata( (int) $user );
		if ( ! $user ) {
			return null;
		}
		$agency_id = self::agency_id( $user->ID );
		$agency    = $agency_id ? $this->agencies->find( $agency_id ) : null;
		$role      = array_values( array_intersect( Roles::portal_roles(), (array) $user->roles ) );

		return array(
			'id'              => $user->ID,
			'first_name'      => $user->first_name,
			'last_name'       => $user->last_name,
			'name'            => trim( $user->first_name . ' ' . $user->last_name ) ? trim( $user->first_name . ' ' . $user->last_name ) : $user->display_name,
			'email'           => $user->user_email,
			'status'          => self::status( $user->ID ),
			'role'            => $role ? $role[0] : ( user_can( $user, Roles::CAP_MANAGE ) ? 'administrator' : '' ),
			'agency'          => $agency ? array(
				'id'     => $agency['id'],
				'name'   => $agency['name'],
				'active' => 'active' === $agency['status'],
			) : null,
			'is_admin'        => user_can( $user, Roles::CAP_MANAGE ),
			'can_view_agency' => user_can( $user, Roles::CAP_VIEW_AGENCY ) && null !== $agency,
			'can_manage_team' => user_can( $user, Roles::CAP_MANAGE_TEAM ) && null !== $agency,
			'disabled_by'     => self::STATUS_DISABLED === self::status( $user->ID ) && get_user_meta( $user->ID, 'cs_disabled_by_manager', true ) ? 'manager' : null,
			'registered'      => Db::iso( get_gmt_from_date( $user->user_registered ) ),
			'source'          => get_user_meta( $user->ID, 'cs_source', true ) ? get_user_meta( $user->ID, 'cs_source', true ) : 'admin',
		);
	}

	/**
	 * Paginated list of portal users for the admin screen.
	 *
	 * @param array $args search, agency (ID|"independent"), status, role, page, per_page.
	 * @return array{items: array, total: int}
	 */
	public function query( array $args ) {
		$per_page = max( 1, min( 100, (int) ( $args['per_page'] ?? 20 ) ) );
		$page     = max( 1, (int) ( $args['page'] ?? 1 ) );

		$query = array(
			'role__in'    => ! empty( $args['role'] ) && in_array( $args['role'], Roles::portal_roles(), true ) ? array( $args['role'] ) : Roles::portal_roles(),
			'number'      => $per_page,
			'paged'       => $page,
			'orderby'     => 'registered',
			'order'       => 'DESC',
			'count_total' => true,
		);

		if ( ! empty( $args['search'] ) ) {
			$query['search']         = '*' . $args['search'] . '*';
			$query['search_columns'] = array( 'user_email', 'display_name', 'user_login' );
		}

		$meta = array();
		if ( isset( $args['agency'] ) && '' !== $args['agency'] ) {
			if ( 'independent' === $args['agency'] ) {
				$meta[] = array(
					'relation' => 'OR',
					array(
						'key'     => 'cs_agency_id',
						'compare' => 'NOT EXISTS',
					),
					array(
						'key'   => 'cs_agency_id',
						'value' => '',
					),
				);
			} else {
				$meta[] = array(
					'key'   => 'cs_agency_id',
					'value' => (int) $args['agency'],
				);
			}
		}
		if ( ! empty( $args['status'] ) ) {
			if ( self::STATUS_ACTIVE === $args['status'] ) {
				$meta[] = array(
					'relation' => 'OR',
					array(
						'key'     => 'cs_status',
						'compare' => 'NOT EXISTS',
					),
					array(
						'key'   => 'cs_status',
						'value' => self::STATUS_ACTIVE,
					),
				);
			} else {
				$meta[] = array(
					'key'   => 'cs_status',
					'value' => sanitize_key( $args['status'] ),
				);
			}
		}
		if ( $meta ) {
			$query['meta_query'] = array_merge( array( 'relation' => 'AND' ), $meta ); // phpcs:ignore WordPress.DB.SlowDBQuery.slow_query_meta_query
		}

		$users = new \WP_User_Query( $query );
		return array(
			'items' => array_map( array( $this, 'profile' ), $users->get_results() ),
			'total' => (int) $users->get_total(),
		);
	}

	/**
	 * Self-service signup. Only emails on an active agency domain are accepted.
	 *
	 * @param array $data first_name, last_name, email, password.
	 * @return int|WP_Error New user ID.
	 */
	public function register( array $data ) {
		$email = strtolower( sanitize_email( $data['email'] ?? '' ) );
		$first = sanitize_text_field( $data['first_name'] ?? '' );
		$last  = sanitize_text_field( $data['last_name'] ?? '' );
		$pass  = (string) ( $data['password'] ?? '' );

		if ( ! is_email( $email ) ) {
			return new WP_Error( 'cs_invalid_email', __( 'Please enter a valid work email address.', 'contact-sync' ), array( 'status' => 400 ) );
		}
		if ( '' === $first || '' === $last ) {
			return new WP_Error( 'cs_invalid_name', __( 'Please enter your first and last name.', 'contact-sync' ), array( 'status' => 400 ) );
		}
		$strength = self::password_error( $pass );
		if ( $strength ) {
			return new WP_Error( 'cs_weak_password', $strength, array( 'status' => 400 ) );
		}

		$agency = $this->agencies->find_by_email( $email );
		if ( ! $agency ) {
			return new WP_Error(
				'cs_domain_not_allowed',
				__( 'Sign up is only available for approved partner email domains. If you believe this is a mistake, please contact your administrator.', 'contact-sync' ),
				array( 'status' => 403 )
			);
		}

		$existing = get_user_by( 'email', $email );
		if ( $existing ) {
			// Re-send verification for unfinished signups instead of revealing account state.
			if ( self::STATUS_PENDING === self::status( $existing->ID ) ) {
				$this->send_verification( $existing->ID );
			}
			return new WP_Error( 'cs_email_exists', __( 'An account with this email already exists. Try signing in or resetting your password.', 'contact-sync' ), array( 'status' => 409 ) );
		}

		$user_id = wp_insert_user(
			array(
				'user_login'   => $this->unique_login( $email ),
				'user_email'   => $email,
				'user_pass'    => $pass,
				'first_name'   => $first,
				'last_name'    => $last,
				'display_name' => trim( $first . ' ' . $last ),
				'role'         => Roles::REP,
			)
		);
		if ( is_wp_error( $user_id ) ) {
			return $user_id;
		}

		update_user_meta( $user_id, 'cs_status', self::STATUS_PENDING );
		update_user_meta( $user_id, 'cs_agency_id', $agency['id'] );
		update_user_meta( $user_id, 'cs_source', 'signup' );
		update_user_meta( $user_id, 'show_admin_bar_front', 'false' );

		$this->send_verification( $user_id );
		return $user_id;
	}

	/**
	 * Generate a fresh verification token and email it.
	 *
	 * @param int $user_id User ID.
	 * @return bool
	 */
	public function send_verification( $user_id ) {
		$user = get_userdata( $user_id );
		if ( ! $user ) {
			return false;
		}
		$token = wp_generate_password( 40, false );
		update_user_meta( $user_id, 'cs_verify_hash', self::hash_token( $token ) );
		update_user_meta( $user_id, 'cs_verify_expires', time() + self::VERIFY_TTL );

		$link = add_query_arg(
			array(
				'uid'   => $user_id,
				'token' => $token,
			),
			Router::url( 'verify' )
		);

		return Mailer::send(
			$user->user_email,
			'verify',
			array(
				'first_name' => $user->first_name,
				'link'       => $link,
			)
		);
	}

	/**
	 * Confirm an email verification token and activate the account.
	 *
	 * @param int    $user_id User ID.
	 * @param string $token   Token from the link.
	 * @return true|WP_Error
	 */
	public function verify( $user_id, $token ) {
		$user = get_userdata( (int) $user_id );
		$hash = $user ? get_user_meta( $user->ID, 'cs_verify_hash', true ) : '';

		if ( $user && self::STATUS_ACTIVE === self::status( $user->ID ) && ! $hash ) {
			return true;
		}
		if ( ! $user || ! $hash || ! hash_equals( $hash, self::hash_token( (string) $token ) ) ) {
			return new WP_Error( 'cs_invalid_token', __( 'This verification link is invalid. Please request a new one.', 'contact-sync' ), array( 'status' => 400 ) );
		}
		if ( (int) get_user_meta( $user->ID, 'cs_verify_expires', true ) < time() ) {
			return new WP_Error( 'cs_expired_token', __( 'This verification link has expired. Please request a new one.', 'contact-sync' ), array( 'status' => 400 ) );
		}
		if ( self::STATUS_DISABLED === self::status( $user->ID ) ) {
			return new WP_Error( 'cs_disabled', __( 'This account has been disabled.', 'contact-sync' ), array( 'status' => 403 ) );
		}

		update_user_meta( $user->ID, 'cs_status', self::STATUS_ACTIVE );
		delete_user_meta( $user->ID, 'cs_verify_hash' );
		delete_user_meta( $user->ID, 'cs_verify_expires' );

		// Domains may have changed since signup; pick up the current agency.
		$this->sync_agency( $user );
		return true;
	}

	/**
	 * Admin invitation. Creates an active account and emails a set-password link.
	 *
	 * @param array $data first_name, last_name, email, agency_id (0 = independent), role.
	 * @return array|WP_Error Profile.
	 */
	public function invite( array $data ) {
		$email = strtolower( sanitize_email( $data['email'] ?? '' ) );
		$first = sanitize_text_field( $data['first_name'] ?? '' );
		$last  = sanitize_text_field( $data['last_name'] ?? '' );
		$role  = in_array( $data['role'] ?? '', Roles::portal_roles(), true ) ? $data['role'] : Roles::REP;

		if ( ! is_email( $email ) ) {
			return new WP_Error( 'cs_invalid_email', __( 'Please enter a valid email address.', 'contact-sync' ), array( 'status' => 400 ) );
		}
		if ( '' === $first ) {
			return new WP_Error( 'cs_invalid_name', __( 'First name is required.', 'contact-sync' ), array( 'status' => 400 ) );
		}
		if ( email_exists( $email ) ) {
			return new WP_Error( 'cs_email_exists', __( 'A user with this email already exists.', 'contact-sync' ), array( 'status' => 409 ) );
		}

		$agency_id = $this->resolve_agency_input( $data['agency_id'] ?? null );
		if ( is_wp_error( $agency_id ) ) {
			return $agency_id;
		}

		$user_id = wp_insert_user(
			array(
				'user_login'   => $this->unique_login( $email ),
				'user_email'   => $email,
				'user_pass'    => wp_generate_password( 24 ),
				'first_name'   => $first,
				'last_name'    => $last,
				'display_name' => trim( $first . ' ' . $last ),
				'role'         => $role,
			)
		);
		if ( is_wp_error( $user_id ) ) {
			return $user_id;
		}

		update_user_meta( $user_id, 'cs_status', self::STATUS_ACTIVE );
		update_user_meta( $user_id, 'cs_source', 'invite' );
		update_user_meta( $user_id, 'cs_agency_locked', 1 );
		update_user_meta( $user_id, 'show_admin_bar_front', 'false' );
		if ( $agency_id ) {
			update_user_meta( $user_id, 'cs_agency_id', $agency_id );
		}

		$this->send_invite( $user_id );
		return $this->profile( $user_id );
	}

	/**
	 * Email an invitation (set password) link.
	 *
	 * @param int $user_id User ID.
	 * @return bool
	 */
	public function send_invite( $user_id ) {
		$user = get_userdata( $user_id );
		if ( ! $user ) {
			return false;
		}
		$key = get_password_reset_key( $user );
		if ( is_wp_error( $key ) ) {
			return false;
		}
		return Mailer::send(
			$user->user_email,
			'invite',
			array(
				'first_name' => $user->first_name,
				'link'       => self::reset_link( $user, $key, true ),
			)
		);
	}

	/**
	 * Admin update of name, agency, role and status.
	 *
	 * @param int   $user_id User ID.
	 * @param array $data    Fields.
	 * @return array|WP_Error Profile.
	 */
	public function update( $user_id, array $data ) {
		$user = get_userdata( (int) $user_id );
		if ( ! $user || ! array_intersect( Roles::portal_roles(), (array) $user->roles ) ) {
			return new WP_Error( 'cs_not_found', __( 'Rep not found.', 'contact-sync' ), array( 'status' => 404 ) );
		}

		$userdata = array( 'ID' => $user->ID );
		if ( isset( $data['first_name'] ) ) {
			$userdata['first_name'] = sanitize_text_field( $data['first_name'] );
		}
		if ( isset( $data['last_name'] ) ) {
			$userdata['last_name'] = sanitize_text_field( $data['last_name'] );
		}
		if ( count( $userdata ) > 1 ) {
			$userdata['display_name'] = trim( ( $userdata['first_name'] ?? $user->first_name ) . ' ' . ( $userdata['last_name'] ?? $user->last_name ) );
			wp_update_user( $userdata );
		}

		if ( array_key_exists( 'agency_id', $data ) ) {
			$agency_id = $this->resolve_agency_input( $data['agency_id'] );
			if ( is_wp_error( $agency_id ) ) {
				return $agency_id;
			}
			if ( $agency_id ) {
				update_user_meta( $user->ID, 'cs_agency_id', $agency_id );
			} else {
				delete_user_meta( $user->ID, 'cs_agency_id' );
			}
			update_user_meta( $user->ID, 'cs_agency_locked', 1 );
		}

		if ( isset( $data['role'] ) && in_array( $data['role'], Roles::portal_roles(), true ) ) {
			$user->set_role( $data['role'] );
		}

		if ( isset( $data['status'] ) && in_array( $data['status'], array( self::STATUS_ACTIVE, self::STATUS_DISABLED, self::STATUS_PENDING ), true ) ) {
			update_user_meta( $user->ID, 'cs_status', $data['status'] );
			// An admin's decision replaces any agency manager's, so the manager can no longer undo it.
			delete_user_meta( $user->ID, 'cs_disabled_by_manager' );
			if ( self::STATUS_DISABLED === $data['status'] ) {
				\WP_Session_Tokens::get_instance( $user->ID )->destroy_all();
			}
		}

		return $this->profile( $user->ID );
	}

	/**
	 * Whether an agency manager may give a rep this status.
	 *
	 * @param array  $target      Rep profile.
	 * @param int    $manager_id  Manager user ID.
	 * @param int    $agency_id   Manager's agency.
	 * @param string $status      active|disabled.
	 * @return true|WP_Error
	 */
	public static function manager_can_set_status( array $target, $manager_id, $agency_id, $status ) {
		if ( empty( $target['agency'] ) || (int) $target['agency']['id'] !== (int) $agency_id || $target['is_admin'] ) {
			return new WP_Error( 'cs_not_found', __( 'Rep not found.', 'contact-sync' ), array( 'status' => 404 ) );
		}
		if ( (int) $target['id'] === (int) $manager_id ) {
			return new WP_Error( 'cs_forbidden', __( 'You cannot change your own access.', 'contact-sync' ), array( 'status' => 403 ) );
		}
		if ( Roles::REP !== $target['role'] ) {
			return new WP_Error( 'cs_forbidden', __( 'Only an administrator can change another agency manager.', 'contact-sync' ), array( 'status' => 403 ) );
		}
		if ( ! in_array( $status, array( self::STATUS_ACTIVE, self::STATUS_DISABLED ), true ) ) {
			return new WP_Error( 'cs_invalid', __( 'Choose whether to enable or disable access.', 'contact-sync' ), array( 'status' => 400 ) );
		}
		if ( self::STATUS_PENDING === $target['status'] ) {
			return new WP_Error( 'cs_forbidden', __( 'This rep has not verified their email yet.', 'contact-sync' ), array( 'status' => 403 ) );
		}
		if ( self::STATUS_ACTIVE === $status && self::STATUS_DISABLED === $target['status'] && 'manager' !== $target['disabled_by'] ) {
			return new WP_Error( 'cs_forbidden', __( 'An administrator disabled this rep. Ask them to restore access.', 'contact-sync' ), array( 'status' => 403 ) );
		}
		return true;
	}

	/**
	 * Enable or disable a rep on behalf of their agency manager.
	 *
	 * @param WP_User $manager Agency manager.
	 * @param int     $rep_id  Rep user ID.
	 * @param string  $status  active|disabled.
	 * @return array|WP_Error Updated profile.
	 */
	public function set_status_by_manager( WP_User $manager, $rep_id, $status ) {
		$target = $this->profile( (int) $rep_id );
		if ( ! $target || ! Roles::is_portal_user( (int) $rep_id ) ) {
			return new WP_Error( 'cs_not_found', __( 'Rep not found.', 'contact-sync' ), array( 'status' => 404 ) );
		}
		$allowed = self::manager_can_set_status( $target, $manager->ID, self::agency_id( $manager->ID ), $status );
		if ( is_wp_error( $allowed ) ) {
			return $allowed;
		}
		if ( $target['status'] === $status ) {
			return $target;
		}

		update_user_meta( $target['id'], 'cs_status', $status );
		if ( self::STATUS_DISABLED === $status ) {
			update_user_meta( $target['id'], 'cs_disabled_by_manager', $manager->ID );
			\WP_Session_Tokens::get_instance( $target['id'] )->destroy_all();
		} else {
			delete_user_meta( $target['id'], 'cs_disabled_by_manager' );
		}
		return $this->profile( $target['id'] );
	}

	/**
	 * Assign the agency matching the user's email domain, unless an admin pinned it.
	 *
	 * @param WP_User $user User.
	 */
	public function sync_agency( WP_User $user ) {
		if ( get_user_meta( $user->ID, 'cs_agency_locked', true ) || ! Roles::is_portal_user( $user ) ) {
			return;
		}
		$agency = $this->agencies->find_by_email( $user->user_email );
		if ( $agency ) {
			update_user_meta( $user->ID, 'cs_agency_id', $agency['id'] );
		}
	}

	/**
	 * Build the portal reset/set password link.
	 *
	 * @param WP_User $user   User.
	 * @param string  $key    Reset key.
	 * @param bool    $invite Whether this is an invitation.
	 * @return string
	 */
	public static function reset_link( WP_User $user, $key, $invite = false ) {
		$args = array(
			'key'   => $key,
			'login' => rawurlencode( $user->user_login ),
		);
		if ( $invite ) {
			$args['invite'] = 1;
		}
		return add_query_arg( $args, Router::url( 'reset-password' ) );
	}

	/**
	 * Minimal password policy. Returns an error message or empty string.
	 *
	 * @param string $password Password.
	 * @return string
	 */
	public static function password_error( $password ) {
		if ( strlen( $password ) < 8 ) {
			return __( 'Password must be at least 8 characters.', 'contact-sync' );
		}
		if ( ! preg_match( '/[A-Za-z]/', $password ) || ! preg_match( '/[0-9]/', $password ) ) {
			return __( 'Password must contain letters and numbers.', 'contact-sync' );
		}
		return '';
	}

	/**
	 * Validate an agency ID from admin input. 0/empty means independent.
	 *
	 * @param mixed $value Raw value.
	 * @return int|WP_Error
	 */
	private function resolve_agency_input( $value ) {
		$agency_id = (int) $value;
		if ( $agency_id && ! $this->agencies->find( $agency_id ) ) {
			return new WP_Error( 'cs_invalid_agency', __( 'Selected agency does not exist.', 'contact-sync' ), array( 'status' => 400 ) );
		}
		return $agency_id;
	}

	/**
	 * Hash a verification token for storage.
	 *
	 * @param string $token Token.
	 * @return string
	 */
	private static function hash_token( $token ) {
		return hash_hmac( 'sha256', $token, wp_salt( 'nonce' ) );
	}

	/**
	 * Derive a unique username from an email address.
	 *
	 * @param string $email Email.
	 * @return string
	 */
	private function unique_login( $email ) {
		$base  = sanitize_user( strtok( $email, '@' ), true );
		$base  = $base ? substr( $base, 0, 50 ) : 'rep';
		$login = $base;
		$i     = 1;
		while ( username_exists( $login ) ) {
			++$i;
			$login = $base . $i;
		}
		return $login;
	}
}
