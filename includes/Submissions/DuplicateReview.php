<?php
/**
 * Admin review of held duplicates.
 *
 * @package ContactSync
 */

namespace ContactSync\Submissions;

use ContactSync\Crm\SyncJob;
use ContactSync\Support\Db;

defined( 'ABSPATH' ) || exit;

/**
 * Approves (sends to Dynamics 365) or rejects leads held as possible duplicates.
 */
class DuplicateReview {

	/**
	 * Repository.
	 *
	 * @var SubmissionRepository
	 */
	private $repo;

	/**
	 * Constructor.
	 *
	 * @param SubmissionRepository|null $repo Repository.
	 */
	public function __construct( ?SubmissionRepository $repo = null ) {
		$this->repo = $repo ? $repo : new SubmissionRepository();
	}

	/**
	 * Approve held leads: queue them for sync, skipping the Dynamics duplicate check.
	 *
	 * @param int[] $ids Submission IDs.
	 * @return int Number approved.
	 */
	public function approve( array $ids ) {
		return $this->decide(
			$ids,
			array(
				'sync_status' => 'queued',
				'attempts'    => 0,
				'last_error'  => null,
			),
			/* translators: %s: admin name */
			__( 'Approved by %s and queued for delivery.', 'contact-sync' ),
			true
		);
	}

	/**
	 * Reject held leads: keep them as duplicates that are never sent.
	 *
	 * @param int[] $ids Submission IDs.
	 * @return int Number rejected.
	 */
	public function reject( array $ids ) {
		return $this->decide(
			$ids,
			array( 'sync_status' => 'duplicate' ),
			/* translators: %s: admin name */
			__( 'Rejected as a duplicate by %s. Not sent to Dynamics 365.', 'contact-sync' ),
			false
		);
	}

	/**
	 * Apply a decision to every held lead in the list.
	 *
	 * @param int[]  $ids     Submission IDs.
	 * @param array  $fields  Columns to set.
	 * @param string $message Log message with %s for the admin name.
	 * @param bool   $queue   Queue for sync afterwards.
	 * @return int Number changed.
	 */
	private function decide( array $ids, array $fields, $message, $queue ) {
		$user  = wp_get_current_user();
		$name  = $user && $user->exists() ? $user->display_name : __( 'an administrator', 'contact-sync' );
		$count = 0;
		foreach ( array_unique( array_map( 'intval', $ids ) ) as $id ) {
			$row = $this->repo->row( $id );
			if ( ! $row || 'review' !== $row['sync_status'] ) {
				continue;
			}
			$this->repo->update( $id, array_merge( $fields, array( 'reviewed_at' => Db::now() ) ) );
			$this->repo->log(
				array(
					'submission_id' => $id,
					'attempt'       => 0,
					'action'        => 'review',
					'message'       => sprintf( $message, $name ),
				)
			);
			if ( $queue ) {
				SyncJob::queue( $id );
			}
			++$count;
		}
		return $count;
	}
}
