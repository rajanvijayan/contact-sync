<?php
/**
 * Import batch persistence.
 *
 * @package ContactSync
 */

namespace ContactSync\Import;

use ContactSync\Crm\SyncJob;
use ContactSync\Submissions\SubmissionRepository;
use ContactSync\Support\Db;

defined( 'ABSPATH' ) || exit;

/**
 * Stores bulk import batches. Progress is derived from the submissions in each batch.
 */
class BatchRepository {

	/**
	 * Create a batch.
	 *
	 * @param int    $rep_id   Rep.
	 * @param int    $form_id  Form.
	 * @param string $filename Uploaded file name.
	 * @return int
	 */
	public function create( $rep_id, $form_id, $filename ) {
		global $wpdb;
		$wpdb->insert(
			Db::table( 'import_batches' ),
			array(
				'rep_id'     => (int) $rep_id,
				'form_id'    => (int) $form_id,
				'filename'   => substr( sanitize_file_name( $filename ), 0, 190 ),
				'total'      => 0,
				'created_at' => Db::now(),
			)
		);
		return (int) $wpdb->insert_id;
	}

	/**
	 * Set the number of rows stored in a batch.
	 *
	 * @param int $id    Batch ID.
	 * @param int $total Row count.
	 */
	public function set_total( $id, $total ) {
		global $wpdb;
		$wpdb->update( Db::table( 'import_batches' ), array( 'total' => (int) $total ), array( 'id' => (int) $id ) );
	}

	/**
	 * Find a batch with progress counts.
	 *
	 * @param int $id Batch ID.
	 * @return array|null
	 */
	public function find( $id ) {
		global $wpdb;
		$table = Db::table( 'import_batches' );
		$row   = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $id ), ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		return $row ? $this->format( $row ) : null;
	}

	/**
	 * Recent batches of a rep.
	 *
	 * @param int $rep_id Rep.
	 * @param int $limit  Max rows.
	 * @return array[]
	 */
	public function for_rep( $rep_id, $limit = 20 ) {
		global $wpdb;
		$table = Db::table( 'import_batches' );
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$rows = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$table} WHERE rep_id = %d ORDER BY id DESC LIMIT %d", $rep_id, $limit ), ARRAY_A );
		return array_map( array( $this, 'format' ), $rows );
	}

	/**
	 * Shape a row with live counts.
	 *
	 * @param array $row Row.
	 * @return array
	 */
	private function format( array $row ) {
		$counts  = ( new SubmissionRepository() )->batch_counts( (int) $row['id'] );
		$pending = $counts['queued'] + $counts['syncing'];
		return array(
			'id'         => (int) $row['id'],
			'rep_id'     => (int) $row['rep_id'],
			'form_id'    => (int) $row['form_id'],
			'filename'   => $row['filename'],
			'total'      => (int) $row['total'],
			'counts'     => $counts,
			'complete'   => 0 === $pending,
			// Pending leads will not move until sync is resumed or Dynamics 365 is connected.
			'held'       => $pending > 0 && ! SyncJob::active(),
			'created_at' => Db::iso( $row['created_at'] ),
		);
	}
}
