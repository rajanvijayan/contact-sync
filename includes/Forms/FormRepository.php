<?php
/**
 * Form persistence.
 *
 * @package ContactSync
 */

namespace ContactSync\Forms;

use ContactSync\Support\Db;
use WP_Error;

defined( 'ABSPATH' ) || exit;

/**
 * CRUD for forms. Saving a changed schema bumps the version.
 */
class FormRepository {

	/**
	 * List forms (without full schema) with submission counts.
	 *
	 * @return array[]
	 */
	public function all() {
		global $wpdb;
		$forms = Db::table( 'forms' );
		$subs  = Db::table( 'submissions' );
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$rows = $wpdb->get_results( "SELECT f.*, (SELECT COUNT(*) FROM {$subs} s WHERE s.form_id = f.id AND s.deleted_at IS NULL) AS submissions FROM {$forms} f ORDER BY f.is_default DESC, f.title ASC", ARRAY_A );
		return array_map(
			function ( $row ) {
				$item                = $this->format( $row );
				$item['field_count'] = count( FormSchema::input_fields( $item['schema'] ) );
				$item['submissions'] = (int) $row['submissions'];
				unset( $item['schema'] );
				return $item;
			},
			$rows
		);
	}

	/**
	 * Find a form.
	 *
	 * @param int $id Form ID.
	 * @return array|null
	 */
	public function find( $id ) {
		global $wpdb;
		$table = Db::table( 'forms' );
		$row   = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $id ), ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		return $row ? $this->format( $row ) : null;
	}

	/**
	 * The form used by the portal.
	 *
	 * @return array|null
	 */
	public function get_default() {
		global $wpdb;
		$table = Db::table( 'forms' );
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$row = $wpdb->get_row( "SELECT * FROM {$table} WHERE is_default = 1 AND status = 'active' ORDER BY id ASC LIMIT 1", ARRAY_A );
		return $row ? $this->format( $row ) : null;
	}

	/**
	 * Create a form.
	 *
	 * @param array $data title, schema, is_default.
	 * @return array|WP_Error
	 */
	public function create( array $data ) {
		global $wpdb;
		$title = sanitize_text_field( $data['title'] ?? '' );
		if ( '' === $title ) {
			return new WP_Error( 'cs_invalid', __( 'Form title is required.', 'contact-sync' ), array( 'status' => 400 ) );
		}
		$schema = FormSchema::sanitize( (array) ( $data['schema'] ?? array() ) );
		$now    = Db::now();

		$wpdb->insert(
			Db::table( 'forms' ),
			array(
				'title'       => $title,
				'status'      => 'active',
				'schema_json' => wp_json_encode( $schema ),
				'version'     => 1,
				'is_default'  => 0,
				'created_at'  => $now,
				'updated_at'  => $now,
			)
		);
		$id = (int) $wpdb->insert_id;

		if ( ! empty( $data['is_default'] ) || ! $this->get_default() ) {
			$this->set_default( $id );
		}
		return $this->find( $id );
	}

	/**
	 * Update a form.
	 *
	 * @param int   $id   Form ID.
	 * @param array $data title, schema, status.
	 * @return array|WP_Error
	 */
	public function update( $id, array $data ) {
		global $wpdb;
		$form = $this->find( $id );
		if ( ! $form ) {
			return new WP_Error( 'cs_not_found', __( 'Form not found.', 'contact-sync' ), array( 'status' => 404 ) );
		}

		$update = array( 'updated_at' => Db::now() );
		if ( isset( $data['title'] ) ) {
			$title = sanitize_text_field( $data['title'] );
			if ( '' === $title ) {
				return new WP_Error( 'cs_invalid', __( 'Form title is required.', 'contact-sync' ), array( 'status' => 400 ) );
			}
			$update['title'] = $title;
		}
		if ( isset( $data['status'] ) && in_array( $data['status'], array( 'active', 'archived' ), true ) ) {
			if ( 'archived' === $data['status'] && $form['is_default'] ) {
				return new WP_Error( 'cs_invalid', __( 'The default form cannot be archived.', 'contact-sync' ), array( 'status' => 400 ) );
			}
			$update['status'] = $data['status'];
		}
		if ( isset( $data['schema'] ) && is_array( $data['schema'] ) ) {
			$schema = FormSchema::sanitize( $data['schema'] );
			if ( $schema !== $form['schema'] ) {
				$update['schema_json'] = wp_json_encode( $schema );
				$update['version']     = $form['version'] + 1;
			}
		}

		$wpdb->update( Db::table( 'forms' ), $update, array( 'id' => (int) $id ) );

		if ( ! empty( $data['is_default'] ) ) {
			$this->set_default( (int) $id );
		}
		return $this->find( $id );
	}

	/**
	 * Mark a form as the portal default.
	 *
	 * @param int $id Form ID.
	 */
	public function set_default( $id ) {
		global $wpdb;
		$table = Db::table( 'forms' );
		$wpdb->query( "UPDATE {$table} SET is_default = 0" ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$wpdb->update(
			$table,
			array(
				'is_default' => 1,
				'status'     => 'active',
			),
			array( 'id' => (int) $id )
		);
	}

	/**
	 * Delete a form. Forms with submissions are archived instead so history stays readable.
	 *
	 * @param int $id Form ID.
	 * @return true|WP_Error
	 */
	public function delete( $id ) {
		global $wpdb;
		$form = $this->find( $id );
		if ( ! $form ) {
			return new WP_Error( 'cs_not_found', __( 'Form not found.', 'contact-sync' ), array( 'status' => 404 ) );
		}
		if ( $form['is_default'] ) {
			return new WP_Error( 'cs_invalid', __( 'Set another form as default before deleting this one.', 'contact-sync' ), array( 'status' => 400 ) );
		}
		$subs  = Db::table( 'submissions' );
		$count = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$subs} WHERE form_id = %d", $id ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		if ( $count > 0 ) {
			$this->update( $id, array( 'status' => 'archived' ) );
			return true;
		}
		$wpdb->delete( Db::table( 'forms' ), array( 'id' => (int) $id ) );
		return true;
	}

	/**
	 * Shape a DB row.
	 *
	 * @param array $row Row.
	 * @return array
	 */
	private function format( array $row ) {
		$schema = json_decode( $row['schema_json'], true );
		return array(
			'id'         => (int) $row['id'],
			'title'      => $row['title'],
			'status'     => $row['status'],
			'version'    => (int) $row['version'],
			'is_default' => (bool) $row['is_default'],
			'schema'     => is_array( $schema ) ? $schema : array(
				'settings' => array(),
				'fields'   => array(),
			),
			'updated_at' => Db::iso( $row['updated_at'] ),
		);
	}
}
