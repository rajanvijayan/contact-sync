<?php
/**
 * Bulk import.
 *
 * @package ContactSync
 */

namespace ContactSync\Import;

use ContactSync\Forms\Validator;
use ContactSync\Submissions\SubmissionRepository;
use ContactSync\Submissions\SubmissionService;
use ContactSync\Support\Settings;
use WP_Error;
use WP_User;

defined( 'ABSPATH' ) || exit;

/**
 * Imports rows that were parsed and column-mapped in the browser.
 *
 * Every row is re-validated on the server with the same rules as the single entry form.
 */
class CsvImporter {

	/**
	 * Batches.
	 *
	 * @var BatchRepository
	 */
	private $batches;

	/**
	 * Submissions.
	 *
	 * @var SubmissionService
	 */
	private $submissions;

	/**
	 * Stored submissions, for duplicate lookups.
	 *
	 * @var SubmissionRepository
	 */
	private $repo;

	/**
	 * Constructor.
	 *
	 * @param BatchRepository|null      $batches     Batches.
	 * @param SubmissionService|null    $submissions Submissions.
	 * @param SubmissionRepository|null $repo        Stored submissions.
	 */
	public function __construct( ?BatchRepository $batches = null, ?SubmissionService $submissions = null, ?SubmissionRepository $repo = null ) {
		$this->batches     = $batches ? $batches : new BatchRepository();
		$this->submissions = $submissions ? $submissions : new SubmissionService();
		$this->repo        = $repo ? $repo : new SubmissionRepository();
	}

	/**
	 * Validate rows without storing anything.
	 *
	 * @param array $form Form.
	 * @param array $rows Rows keyed by field key.
	 * @return array[] Per row: index, errors, duplicate (existing|file|null).
	 */
	public function validate( array $form, array $rows ) {
		$report = array();
		$emails = array();
		foreach ( array_values( $rows ) as $index => $row ) {
			$result   = Validator::validate( $form['schema'], is_array( $row ) ? $row : array(), true );
			$report[] = array(
				'index'     => $index,
				'errors'    => (object) $result['errors'],
				'duplicate' => null,
			);
			if ( ! $result['errors'] ) {
				$emails[ $index ] = SubmissionRepository::normalize_email( SubmissionService::summary( $form['schema'], $result['values'] )['email'] );
			}
		}
		if ( ! SubmissionService::hold_duplicates() ) {
			return $report;
		}

		// Mirrors import(): a row is held when its email is already stored or appears on an earlier valid row.
		$existing = $this->repo->find_by_emails( array_values( $emails ) );
		$seen     = array();
		foreach ( $emails as $index => $email ) {
			if ( ! $email ) {
				continue;
			}
			if ( isset( $existing[ $email ] ) ) {
				$report[ $index ]['duplicate'] = 'existing';
			} elseif ( isset( $seen[ $email ] ) ) {
				$report[ $index ]['duplicate'] = 'file';
			}
			$seen[ $email ] = true;
		}
		return $report;
	}

	/**
	 * Import rows as a batch. Invalid rows are skipped and reported.
	 *
	 * @param array   $form     Form.
	 * @param WP_User $user     Rep.
	 * @param array   $rows     Rows keyed by field key.
	 * @param string  $filename Original file name.
	 * @return array|WP_Error batch, imported, rejected[].
	 */
	public function import( array $form, WP_User $user, array $rows, $filename ) {
		$max = (int) Settings::get( 'security.max_csv_rows', 1000 );
		if ( ! $rows ) {
			return new WP_Error( 'cs_empty', __( 'The file has no rows to import.', 'contact-sync' ), array( 'status' => 400 ) );
		}
		if ( count( $rows ) > $max ) {
			/* translators: %d: row limit */
			return new WP_Error( 'cs_too_many_rows', sprintf( __( 'A single import is limited to %d rows. Split the file and try again.', 'contact-sync' ), $max ), array( 'status' => 400 ) );
		}

		$batch_id = $this->batches->create( $user->ID, $form['id'], $filename );
		$imported = 0;
		$rejected = array();

		foreach ( array_values( $rows ) as $index => $row ) {
			$result = $this->submissions->create(
				$form,
				$user,
				is_array( $row ) ? $row : array(),
				array(
					'source'   => 'import',
					'batch_id' => $batch_id,
					'lenient'  => true,
				)
			);
			if ( is_wp_error( $result ) ) {
				$data       = $result->get_error_data();
				$rejected[] = array(
					'index'  => $index,
					'errors' => (object) ( $data['errors'] ?? array() ),
				);
				continue;
			}
			++$imported;
		}

		$this->batches->set_total( $batch_id, $imported );

		return array(
			'batch'    => $this->batches->find( $batch_id ),
			'imported' => $imported,
			'rejected' => $rejected,
		);
	}
}
