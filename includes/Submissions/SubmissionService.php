<?php
/**
 * Submission creation.
 *
 * @package ContactSync
 */

namespace ContactSync\Submissions;

use ContactSync\Crm\LeadMapper;
use ContactSync\Crm\SyncJob;
use ContactSync\Forms\FormSchema;
use ContactSync\Forms\Validator;
use ContactSync\Reps\RepService;
use WP_Error;
use WP_User;

defined( 'ABSPATH' ) || exit;

/**
 * Validates input, stores the submission and queues it for CRM sync.
 */
class SubmissionService {

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
	 * Create a submission from a rep.
	 *
	 * The agency is always taken from the rep's profile, never from the request.
	 *
	 * @param array   $form     Form (with schema).
	 * @param WP_User $user     Submitting rep.
	 * @param array   $input    Raw values.
	 * @param array   $options  source (form|import), batch_id, lenient.
	 * @return int|WP_Error Submission ID, or error with field errors in data.errors.
	 */
	public function create( array $form, WP_User $user, array $input, array $options = array() ) {
		$result = Validator::validate( $form['schema'], $input, ! empty( $options['lenient'] ) );
		if ( $result['errors'] ) {
			return new WP_Error(
				'cs_validation',
				__( 'Please correct the highlighted fields.', 'contact-sync' ),
				array(
					'status' => 422,
					'errors' => $result['errors'],
				)
			);
		}

		$id = $this->repo->insert(
			array(
				'form_id'      => $form['id'],
				'form_version' => $form['version'],
				'rep_id'       => $user->ID,
				'agency_id'    => RepService::agency_id( $user->ID ),
				'batch_id'     => $options['batch_id'] ?? null,
				'source'       => $options['source'] ?? 'form',
				'data'         => array(
					'values'  => $result['values'],
					'labels'  => self::labels( $form['schema'] ),
					'display' => self::display( $form['schema'], $result['values'] ),
					'summary' => self::summary( $form['schema'], $result['values'] ),
				),
			)
		);

		SyncJob::queue( $id );

		/**
		 * Fires after a lead submission is stored.
		 *
		 * @param int   $id     Submission ID.
		 * @param array $values Clean values.
		 * @param array $form   Form.
		 */
		do_action( 'contact_sync_submission_created', $id, $result['values'], $form );

		return $id;
	}

	/**
	 * Field labels at the time of submission, so history stays readable after form edits.
	 *
	 * @param array $schema Schema.
	 * @return array
	 */
	public static function labels( array $schema ) {
		$labels = array();
		foreach ( FormSchema::input_fields( $schema ) as $field ) {
			$labels[ $field['key'] ] = '' !== $field['label'] ? $field['label'] : $field['key'];
		}
		return $labels;
	}

	/**
	 * Human readable values (option labels, Yes/No, joined lists) at the time of submission.
	 *
	 * @param array $schema Schema.
	 * @param array $values Values.
	 * @return array
	 */
	public static function display( array $schema, array $values ) {
		$display = array();
		foreach ( FormSchema::input_fields( $schema ) as $field ) {
			if ( array_key_exists( $field['key'], $values ) ) {
				$display[ $field['key'] ] = LeadMapper::display( $field, $values[ $field['key'] ] );
			}
		}
		return $display;
	}

	/**
	 * Name / email / company columns for list views, derived from CRM mappings.
	 *
	 * @param array $schema Schema.
	 * @param array $values Values.
	 * @return array
	 */
	public static function summary( array $schema, array $values ) {
		$by_attr = array();
		foreach ( FormSchema::input_fields( $schema ) as $field ) {
			$attr = $field['crm']['attribute'] ?? '';
			if ( $attr && isset( $values[ $field['key'] ] ) && is_string( $values[ $field['key'] ] ) ) {
				$by_attr[ $attr ] = $values[ $field['key'] ];
			}
		}

		$name = trim( ( $by_attr['firstname'] ?? '' ) . ' ' . ( $by_attr['lastname'] ?? '' ) );
		if ( '' === $name ) {
			$name = $by_attr['fullname'] ?? '';
		}
		$email = $by_attr['emailaddress1'] ?? '';
		if ( '' === $email ) {
			foreach ( FormSchema::input_fields( $schema ) as $field ) {
				if ( 'email' === $field['type'] && ! empty( $values[ $field['key'] ] ) ) {
					$email = $values[ $field['key'] ];
					break;
				}
			}
		}

		return array(
			'name'    => $name,
			'email'   => $email,
			'company' => $by_attr['companyname'] ?? '',
		);
	}
}
