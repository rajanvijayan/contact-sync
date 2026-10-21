<?php
/**
 * Background CRM synchronisation.
 *
 * @package ContactSync
 */

namespace ContactSync\Crm;

use ContactSync\Agencies\AgencyRepository;
use ContactSync\Forms\FormRepository;
use ContactSync\Submissions\SubmissionRepository;
use ContactSync\Support\Db;
use ContactSync\Support\Settings;

defined( 'ABSPATH' ) || exit;

/**
 * Pushes queued submissions to Dynamics through Action Scheduler with retry/backoff.
 */
class SyncJob {

	const HOOK  = 'contact_sync_sync_submission';
	const GROUP = 'contact-sync';

	/**
	 * Delay in seconds before retry N (1-based).
	 *
	 * @var int[]
	 */
	const BACKOFF = array( 60, 300, 900, 3600, 7200, 14400 );

	/**
	 * Client.
	 *
	 * @var DynamicsClient
	 */
	private $client;

	/**
	 * Submissions.
	 *
	 * @var SubmissionRepository
	 */
	private $repo;

	/**
	 * Constructor.
	 *
	 * @param DynamicsClient|null       $client Client.
	 * @param SubmissionRepository|null $repo   Repository.
	 */
	public function __construct( ?DynamicsClient $client = null, ?SubmissionRepository $repo = null ) {
		$this->client = $client ? $client : new DynamicsClient();
		$this->repo   = $repo ? $repo : new SubmissionRepository();
	}

	/**
	 * Register the action hook.
	 */
	public static function register() {
		add_action(
			self::HOOK,
			function ( $submission_id ) {
				( new self() )->run( (int) $submission_id );
			}
		);
	}

	/**
	 * Schedule a submission for sync.
	 *
	 * @param int  $submission_id Submission ID.
	 * @param int  $delay         Seconds from now.
	 * @param bool $dedupe        Skip when already scheduled. Retries from inside a running
	 *                            action pass false, since the running action still counts.
	 */
	public static function queue( $submission_id, $delay = 0, $dedupe = true ) {
		$args = array( (int) $submission_id );
		if ( function_exists( 'as_schedule_single_action' ) ) {
			if ( $dedupe && function_exists( 'as_has_scheduled_action' ) && as_has_scheduled_action( self::HOOK, $args, self::GROUP ) ) {
				return;
			}
			if ( $delay > 0 ) {
				as_schedule_single_action( time() + $delay, self::HOOK, $args, self::GROUP );
			} else {
				as_enqueue_async_action( self::HOOK, $args, self::GROUP );
			}
			return;
		}
		wp_schedule_single_event( time() + $delay, self::HOOK, $args );
	}

	/**
	 * Reset and re-queue submissions (admin retry).
	 *
	 * @param int[] $ids Submission IDs.
	 * @return int Number queued.
	 */
	public function retry( array $ids ) {
		$count = 0;
		foreach ( $ids as $id ) {
			$row = $this->repo->row( $id );
			if ( ! $row || 'synced' === $row['sync_status'] ) {
				continue;
			}
			$this->repo->update(
				$id,
				array(
					'sync_status' => 'queued',
					'attempts'    => 0,
					'last_error'  => null,
				)
			);
			self::queue( $id );
			++$count;
		}
		return $count;
	}

	/**
	 * Sync one submission.
	 *
	 * @param int $submission_id Submission ID.
	 */
	public function run( $submission_id ) {
		$row = $this->repo->row( $submission_id );
		if ( ! $row || in_array( $row['sync_status'], array( 'synced', 'duplicate' ), true ) ) {
			return;
		}
		if ( ! Settings::get( 'sync.enabled', true ) ) {
			// Paused: stay queued; "Sync queued leads" in the admin resumes them.
			return;
		}

		$attempt = (int) $row['attempts'] + 1;
		$this->repo->update(
			$submission_id,
			array(
				'sync_status' => 'syncing',
				'attempts'    => $attempt,
			)
		);

		$payload = array();
		try {
			$payload = $this->payload( $row );
			$sync    = Settings::get( 'sync', array() );

			if ( 'skip' === $sync['duplicate_check'] && ! empty( $payload['emailaddress1'] ) ) {
				$existing = $this->client->find_lead_by_email( $payload['emailaddress1'] );
				if ( $existing ) {
					$this->finish( $submission_id, 'duplicate', $existing, $attempt, 'find_lead', __( 'An open lead with this email already exists in Dynamics 365.', 'contact-sync' ), $payload );
					return;
				}
			}

			$lead_id = $this->client->create_lead( $payload );
			$this->finish( $submission_id, 'synced', $lead_id, $attempt, 'create_lead', __( 'Lead created.', 'contact-sync' ), $payload );
		} catch ( CrmException $e ) {
			$this->fail( $submission_id, $attempt, $e->getMessage(), $e->status, $e->retryable, $e->body, $payload );
		} catch ( \Throwable $e ) {
			$this->fail( $submission_id, $attempt, $e->getMessage(), 0, false, '', $payload );
		}
	}

	/**
	 * Build the lead payload for a stored row.
	 *
	 * @param array $row Submission row.
	 * @return array
	 * @throws CrmException When the form no longer exists.
	 */
	private function payload( array $row ) {
		$form = ( new FormRepository() )->find( (int) $row['form_id'] );
		if ( ! $form ) {
			throw new CrmException( __( 'The form for this submission no longer exists.', 'contact-sync' ) );
		}
		$user   = get_userdata( (int) $row['rep_id'] );
		$agency = $row['agency_id'] ? ( new AgencyRepository() )->find( (int) $row['agency_id'] ) : null;

		return LeadMapper::map(
			$form['schema'],
			$row['data']['values'] ?? array(),
			array(
				'rep_name'    => $user ? $user->display_name : '',
				'rep_email'   => $user ? $user->user_email : '',
				'agency_name' => $agency ? $agency['name'] : null,
				'product'     => Settings::get( 'branding.product_name', get_bloginfo( 'name' ) ),
			)
		);
	}

	/**
	 * Record a successful outcome.
	 *
	 * @param int    $id      Submission ID.
	 * @param string $status  synced|duplicate.
	 * @param string $lead_id Lead ID.
	 * @param int    $attempt Attempt.
	 * @param string $action  Log action.
	 * @param string $message Log message.
	 * @param array  $payload Payload sent.
	 */
	private function finish( $id, $status, $lead_id, $attempt, $action, $message, array $payload ) {
		$this->repo->update(
			$id,
			array(
				'sync_status' => $status,
				'crm_lead_id' => $lead_id,
				'last_error'  => null,
				'synced_at'   => Db::now(),
			)
		);
		$this->repo->log(
			array(
				'submission_id' => $id,
				'attempt'       => $attempt,
				'action'        => $action,
				'http_status'   => 'synced' === $status ? 201 : 200,
				'message'       => $message,
				'request_body'  => wp_json_encode( $payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ),
				'response_body' => wp_json_encode( array( 'leadid' => $lead_id ) ),
			)
		);

		/**
		 * Fires after a submission reaches Dynamics.
		 *
		 * @param int    $id      Submission ID.
		 * @param string $lead_id Lead ID.
		 * @param string $status  synced|duplicate.
		 */
		do_action( 'contact_sync_submission_synced', $id, $lead_id, $status );
	}

	/**
	 * Record a failure and schedule a retry when appropriate.
	 *
	 * @param int    $id        Submission ID.
	 * @param int    $attempt   Attempt.
	 * @param string $message   Error.
	 * @param int    $status    HTTP status.
	 * @param bool   $retryable Retryable.
	 * @param string $body      Response body.
	 * @param array  $payload   Payload.
	 */
	private function fail( $id, $attempt, $message, $status, $retryable, $body, array $payload ) {
		$max   = (int) Settings::get( 'sync.max_attempts', 5 );
		$retry = $retryable && $attempt < $max;

		$this->repo->update(
			$id,
			array(
				'sync_status' => $retry ? 'queued' : 'failed',
				'last_error'  => $message,
			)
		);
		$this->repo->log(
			array(
				'submission_id' => $id,
				'attempt'       => $attempt,
				'action'        => 'create_lead',
				'http_status'   => $status ? $status : null,
				'message'       => $retry ? $message . ' ' . __( '(will retry)', 'contact-sync' ) : $message,
				'request_body'  => $payload ? wp_json_encode( $payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) : null,
				'response_body' => $body,
			)
		);

		if ( $retry ) {
			$delay = self::BACKOFF[ min( $attempt, count( self::BACKOFF ) ) - 1 ];
			self::queue( $id, $delay, false );
		}
	}
}
