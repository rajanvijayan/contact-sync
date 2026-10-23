<?php
/**
 * Roles and capabilities.
 *
 * @package ContactSync
 */

namespace ContactSync;

defined( 'ABSPATH' ) || exit;

/**
 * Registers the rep roles and admin capabilities.
 */
class Roles {

	const REP            = 'cs_rep';
	const AGENCY_MANAGER = 'cs_agency_manager';

	const CAP_SUBMIT      = 'cs_submit_leads';
	const CAP_VIEW_AGENCY = 'cs_view_agency_leads';
	const CAP_MANAGE_TEAM = 'cs_manage_agency_reps';
	const CAP_MANAGE      = 'manage_contact_sync';

	/**
	 * Create roles and grant capabilities. Safe to run repeatedly.
	 */
	public static function install() {
		remove_role( self::REP );
		remove_role( self::AGENCY_MANAGER );

		add_role(
			self::REP,
			__( 'Rep', 'contact-sync' ),
			array(
				'read'           => true,
				self::CAP_SUBMIT => true,
			)
		);

		add_role(
			self::AGENCY_MANAGER,
			__( 'Agency Manager', 'contact-sync' ),
			array(
				'read'                => true,
				self::CAP_SUBMIT      => true,
				self::CAP_VIEW_AGENCY => true,
				self::CAP_MANAGE_TEAM => true,
			)
		);

		$admin = get_role( 'administrator' );
		if ( $admin ) {
			$admin->add_cap( self::CAP_MANAGE );
			$admin->add_cap( self::CAP_SUBMIT );
			$admin->add_cap( self::CAP_VIEW_AGENCY );
			$admin->add_cap( self::CAP_MANAGE_TEAM );
		}
	}

	/**
	 * Whether a user is a portal user (rep or manager) rather than a site administrator.
	 *
	 * @param \WP_User|int $user User.
	 * @return bool
	 */
	public static function is_portal_user( $user ) {
		$user = $user instanceof \WP_User ? $user : get_userdata( $user );
		if ( ! $user ) {
			return false;
		}
		return (bool) array_intersect( array( self::REP, self::AGENCY_MANAGER ), (array) $user->roles ) && ! user_can( $user, self::CAP_MANAGE );
	}

	/**
	 * Roles that may be assigned to portal users.
	 *
	 * @return string[]
	 */
	public static function portal_roles() {
		return array( self::REP, self::AGENCY_MANAGER );
	}
}
