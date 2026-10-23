<?php
/**
 * Agency persistence.
 *
 * @package ContactSync
 */

namespace ContactSync\Agencies;

use ContactSync\Support\Db;
use ContactSync\Support\Settings;
use WP_Error;

defined( 'ABSPATH' ) || exit;

/**
 * CRUD for agencies and their domains.
 */
class AgencyRepository {

	/**
	 * Agency status by ID for the current request.
	 *
	 * @var array<int,string|null>
	 */
	private static $status_cache = array();

	/**
	 * Status of an agency (active|inactive), or null when it does not exist. Cached per request.
	 *
	 * @param int $id Agency ID.
	 * @return string|null
	 */
	public static function status( $id ) {
		global $wpdb;
		$id = (int) $id;
		if ( ! array_key_exists( $id, self::$status_cache ) ) {
			$table                     = Db::table( 'agencies' );
			$status                    = $wpdb->get_var( $wpdb->prepare( "SELECT status FROM {$table} WHERE id = %d", $id ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			self::$status_cache[ $id ] = null === $status ? null : (string) $status;
		}
		return self::$status_cache[ $id ];
	}

	/**
	 * Enable or disable an agency without touching its other details.
	 *
	 * @param int  $id     Agency ID.
	 * @param bool $active Active.
	 * @return array|WP_Error Updated agency.
	 */
	public function set_active( $id, $active ) {
		global $wpdb;
		if ( ! $this->find( $id ) ) {
			return new WP_Error( 'cs_not_found', __( 'Agency not found.', 'contact-sync' ), array( 'status' => 404 ) );
		}
		$wpdb->update(
			Db::table( 'agencies' ),
			array(
				'status'     => $active ? 'active' : 'inactive',
				'updated_at' => Db::now(),
			),
			array( 'id' => (int) $id )
		);
		return $this->find( $id );
	}


	/**
	 * List agencies with domains and rep counts.
	 *
	 * @param array $args Optional "search" and "status".
	 * @return array[]
	 */
	public function all( array $args = array() ) {
		global $wpdb;
		$table = Db::table( 'agencies' );
		$where = array( '1=1' );
		$vals  = array();

		if ( ! empty( $args['search'] ) ) {
			$where[] = 'name LIKE %s';
			$vals[]  = '%' . $wpdb->esc_like( $args['search'] ) . '%';
		}
		if ( ! empty( $args['status'] ) ) {
			$where[] = 'status = %s';
			$vals[]  = $args['status'];
		}

		$sql = "SELECT * FROM {$table} WHERE " . implode( ' AND ', $where ) . ' ORDER BY name ASC';
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		$rows = $vals ? $wpdb->get_results( $wpdb->prepare( $sql, $vals ), ARRAY_A ) : $wpdb->get_results( $sql, ARRAY_A );

		$domains = $this->domains_by_agency();
		$counts  = $this->rep_counts();

		return array_map(
			function ( $row ) use ( $domains, $counts ) {
				return $this->format( $row, $domains[ $row['id'] ] ?? array(), $counts[ $row['id'] ] ?? 0 );
			},
			$rows
		);
	}

	/**
	 * Find a single agency.
	 *
	 * @param int $id Agency ID.
	 * @return array|null
	 */
	public function find( $id ) {
		global $wpdb;
		unset( self::$status_cache[ (int) $id ] );
		$table = Db::table( 'agencies' );
		$row   = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $id ), ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		if ( ! $row ) {
			return null;
		}
		$domains = $this->domains_by_agency( (int) $id );
		$counts  = $this->rep_counts();
		return $this->format( $row, $domains[ $row['id'] ] ?? array(), $counts[ $row['id'] ] ?? 0 );
	}

	/**
	 * Find the active agency an email address belongs to.
	 *
	 * @param string $email Email address.
	 * @return array|null
	 */
	public function find_by_email( $email ) {
		global $wpdb;
		$candidates = DomainMatcher::candidates( DomainMatcher::from_email( $email ), (bool) Settings::get( 'security.match_subdomains', false ) );
		if ( ! $candidates ) {
			return null;
		}

		$domains      = Db::table( 'agency_domains' );
		$agencies     = Db::table( 'agencies' );
		$placeholders = implode( ',', array_fill( 0, count( $candidates ), '%s' ) );
		// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT d.domain, a.id FROM {$domains} d INNER JOIN {$agencies} a ON a.id = d.agency_id WHERE a.status = 'active' AND d.domain IN ({$placeholders})",
				$candidates
			),
			ARRAY_A
		);
		// phpcs:enable
		if ( ! $rows ) {
			return null;
		}

		$by_domain = wp_list_pluck( $rows, 'id', 'domain' );
		foreach ( $candidates as $candidate ) {
			if ( isset( $by_domain[ $candidate ] ) ) {
				return $this->find( (int) $by_domain[ $candidate ] );
			}
		}
		return null;
	}

	/**
	 * Create an agency.
	 *
	 * @param array $data name, status, domains[], notes, crm_account_id.
	 * @return array|WP_Error
	 */
	public function create( array $data ) {
		global $wpdb;
		$clean = $this->sanitize( $data );
		if ( is_wp_error( $clean ) ) {
			return $clean;
		}

		$conflict = $this->domain_conflicts( $clean['domains'] );
		if ( is_wp_error( $conflict ) ) {
			return $conflict;
		}

		$now = Db::now();
		$wpdb->insert(
			Db::table( 'agencies' ),
			array(
				'name'           => $clean['name'],
				'status'         => $clean['status'],
				'crm_account_id' => $clean['crm_account_id'],
				'notes'          => $clean['notes'],
				'created_at'     => $now,
				'updated_at'     => $now,
			)
		);
		$id = (int) $wpdb->insert_id;
		$this->set_domains( $id, $clean['domains'] );

		return $this->find( $id );
	}

	/**
	 * Update an agency.
	 *
	 * @param int   $id   Agency ID.
	 * @param array $data Fields to update.
	 * @return array|WP_Error
	 */
	public function update( $id, array $data ) {
		global $wpdb;
		$existing = $this->find( $id );
		if ( ! $existing ) {
			return new WP_Error( 'cs_not_found', __( 'Agency not found.', 'contact-sync' ), array( 'status' => 404 ) );
		}

		$clean = $this->sanitize( array_merge( $existing, $data ) );
		if ( is_wp_error( $clean ) ) {
			return $clean;
		}

		$conflict = $this->domain_conflicts( $clean['domains'], (int) $id );
		if ( is_wp_error( $conflict ) ) {
			return $conflict;
		}

		$wpdb->update(
			Db::table( 'agencies' ),
			array(
				'name'           => $clean['name'],
				'status'         => $clean['status'],
				'crm_account_id' => $clean['crm_account_id'],
				'notes'          => $clean['notes'],
				'updated_at'     => Db::now(),
			),
			array( 'id' => (int) $id )
		);
		$this->set_domains( (int) $id, $clean['domains'] );

		return $this->find( $id );
	}

	/**
	 * Delete an agency. Reps attached to it become independent.
	 *
	 * @param int $id Agency ID.
	 * @return bool
	 */
	public function delete( $id ) {
		global $wpdb;
		$wpdb->delete( Db::table( 'agency_domains' ), array( 'agency_id' => (int) $id ) );
		$deleted = (bool) $wpdb->delete( Db::table( 'agencies' ), array( 'id' => (int) $id ) );

		$users = get_users(
			array(
				'meta_key'   => 'cs_agency_id', // phpcs:ignore WordPress.DB.SlowDBQuery.slow_query_meta_key
				'meta_value' => (int) $id, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_query_meta_value
				'fields'     => 'ID',
			)
		);
		foreach ( $users as $user_id ) {
			delete_user_meta( $user_id, 'cs_agency_id' );
		}
		return $deleted;
	}

	/**
	 * Replace the domain list of an agency.
	 *
	 * @param int      $id      Agency ID.
	 * @param string[] $domains Normalised domains.
	 */
	private function set_domains( $id, array $domains ) {
		global $wpdb;
		$table = Db::table( 'agency_domains' );
		$wpdb->delete( $table, array( 'agency_id' => $id ) );
		foreach ( $domains as $domain ) {
			$wpdb->insert(
				$table,
				array(
					'agency_id' => $id,
					'domain'    => $domain,
				)
			);
		}
	}

	/**
	 * Validate and normalise agency input.
	 *
	 * @param array $data Raw data.
	 * @return array|WP_Error
	 */
	private function sanitize( array $data ) {
		$name = isset( $data['name'] ) ? sanitize_text_field( $data['name'] ) : '';
		if ( '' === $name ) {
			return new WP_Error( 'cs_invalid', __( 'Agency name is required.', 'contact-sync' ), array( 'status' => 400 ) );
		}

		$domains = array();
		$invalid = array();
		foreach ( (array) ( $data['domains'] ?? array() ) as $raw ) {
			$domain = DomainMatcher::normalize( $raw );
			if ( '' === $domain ) {
				if ( '' !== trim( (string) $raw ) ) {
					$invalid[] = sanitize_text_field( $raw );
				}
				continue;
			}
			$domains[] = $domain;
		}
		if ( $invalid ) {
			/* translators: %s: list of invalid domains */
			return new WP_Error( 'cs_invalid', sprintf( __( 'Invalid domain: %s', 'contact-sync' ), implode( ', ', $invalid ) ), array( 'status' => 400 ) );
		}

		return array(
			'name'           => $name,
			'status'         => ( isset( $data['status'] ) && 'inactive' === $data['status'] ) ? 'inactive' : 'active',
			'crm_account_id' => isset( $data['crm_account_id'] ) && '' !== $data['crm_account_id'] ? sanitize_text_field( $data['crm_account_id'] ) : null,
			'notes'          => isset( $data['notes'] ) ? sanitize_textarea_field( $data['notes'] ) : '',
			'domains'        => array_values( array_unique( $domains ) ),
		);
	}

	/**
	 * Ensure no domain already belongs to a different agency.
	 *
	 * @param string[] $domains    Domains.
	 * @param int      $exclude_id Agency being edited.
	 * @return true|WP_Error
	 */
	private function domain_conflicts( array $domains, $exclude_id = 0 ) {
		global $wpdb;
		if ( ! $domains ) {
			return true;
		}
		$table        = Db::table( 'agency_domains' );
		$placeholders = implode( ',', array_fill( 0, count( $domains ), '%s' ) );
		$params       = array_merge( $domains, array( (int) $exclude_id ) );
		// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
		$taken = $wpdb->get_col( $wpdb->prepare( "SELECT domain FROM {$table} WHERE domain IN ({$placeholders}) AND agency_id <> %d", $params ) );
		// phpcs:enable
		if ( $taken ) {
			/* translators: %s: list of domains */
			return new WP_Error( 'cs_domain_taken', sprintf( __( 'Already assigned to another agency: %s', 'contact-sync' ), implode( ', ', $taken ) ), array( 'status' => 409 ) );
		}
		return true;
	}

	/**
	 * Map of agency ID => domain list.
	 *
	 * @param int $agency_id Optional single agency.
	 * @return array
	 */
	private function domains_by_agency( $agency_id = 0 ) {
		global $wpdb;
		$table = Db::table( 'agency_domains' );
		// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$rows = $agency_id
			? $wpdb->get_results( $wpdb->prepare( "SELECT agency_id, domain FROM {$table} WHERE agency_id = %d ORDER BY domain", $agency_id ), ARRAY_A )
			: $wpdb->get_results( "SELECT agency_id, domain FROM {$table} ORDER BY domain", ARRAY_A );
		// phpcs:enable
		$map = array();
		foreach ( $rows as $row ) {
			$map[ $row['agency_id'] ][] = $row['domain'];
		}
		return $map;
	}

	/**
	 * Map of agency ID => number of reps.
	 *
	 * @return array
	 */
	private function rep_counts() {
		global $wpdb;
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT meta_value AS agency_id, COUNT(*) AS total FROM {$wpdb->usermeta} WHERE meta_key = %s GROUP BY meta_value",
				'cs_agency_id'
			),
			ARRAY_A
		);
		return wp_list_pluck( $rows, 'total', 'agency_id' );
	}

	/**
	 * Shape a row for API output.
	 *
	 * @param array    $row     DB row.
	 * @param string[] $domains Domains.
	 * @param int      $reps    Rep count.
	 * @return array
	 */
	private function format( array $row, array $domains, $reps ) {
		return array(
			'id'             => (int) $row['id'],
			'name'           => $row['name'],
			'status'         => $row['status'],
			'crm_account_id' => $row['crm_account_id'],
			'notes'          => (string) $row['notes'],
			'domains'        => $domains,
			'rep_count'      => (int) $reps,
			'created_at'     => Db::iso( $row['created_at'] ),
		);
	}
}
