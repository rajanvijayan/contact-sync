<?php
/**
 * Rep portal endpoints.
 *
 * @package ContactSync
 */

namespace ContactSync\Rest;

use ContactSync\Forms\FormRepository;
use ContactSync\Import\BatchRepository;
use ContactSync\Import\CsvImporter;
use ContactSync\Import\SampleCsv;
use ContactSync\Reps\RepService;
use ContactSync\Submissions\SubmissionRepository;
use ContactSync\Submissions\SubmissionService;
use WP_Error;
use WP_REST_Request;
use WP_REST_Server;

defined( 'ABSPATH' ) || exit;

/**
 * Profile, lead entry, submissions and bulk import for signed-in reps.
 */
class PortalController extends Controller {

	/**
	 * Register routes.
	 */
	public function routes() {
		$perm = array( $this, 'can_submit' );

		$this->route(
			'/portal/me',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'me' ),
				'permission_callback' => $perm,
			)
		);
		$this->route(
			'/portal/submissions',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'list_submissions' ),
					'permission_callback' => $perm,
					'args'                => $this->pagination_args(),
				),
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'create_submission' ),
					'permission_callback' => $perm,
				),
			)
		);
		$this->route(
			'/portal/submissions/(?P<id>\d+)',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'get_submission' ),
				'permission_callback' => $perm,
			)
		);
		$this->route(
			'/portal/imports/validate',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'validate_import' ),
				'permission_callback' => $perm,
			)
		);
		$this->route(
			'/portal/imports',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'list_imports' ),
					'permission_callback' => $perm,
				),
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'create_import' ),
					'permission_callback' => $perm,
				),
			)
		);
		$this->route(
			'/portal/imports/(?P<id>\d+)',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'get_import' ),
				'permission_callback' => $perm,
			)
		);
		$this->route(
			'/portal/sample-csv',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'sample_csv' ),
				'permission_callback' => $perm,
			)
		);
	}

	/**
	 * GET /portal/me — profile, active form and personal stats.
	 *
	 * @return mixed
	 */
	public function me() {
		$user  = wp_get_current_user();
		$form  = ( new FormRepository() )->get_default();
		$repo  = new SubmissionRepository();
		$scope = array( 'rep_id' => $user->ID );

		return $this->respond(
			array(
				'user'   => ( new RepService() )->profile( $user ),
				'form'   => $form,
				'stats'  => $repo->stats( $scope, 14 ),
				'recent' => $repo->query( array_merge( $scope, array( 'per_page' => 5 ) ) )['items'],
			)
		);
	}

	/**
	 * GET /portal/submissions
	 *
	 * @param WP_REST_Request $request Request.
	 * @return mixed
	 */
	public function list_submissions( WP_REST_Request $request ) {
		$args  = array(
			'status'   => $request['status'],
			'search'   => $request['search'],
			'batch_id' => $request['batch_id'],
			'source'   => $request['source'],
			'page'     => $request['page'],
			'per_page' => $request['per_page'],
		);
		$scope = $this->scope( $request['scope'] );
		if ( is_wp_error( $scope ) ) {
			return $scope;
		}
		return $this->paginated( ( new SubmissionRepository() )->query( array_merge( $args, $scope ) ), (int) $request['per_page'] );
	}

	/**
	 * POST /portal/submissions
	 *
	 * @param WP_REST_Request $request Request.
	 * @return mixed
	 */
	public function create_submission( WP_REST_Request $request ) {
		$form = $this->form();
		if ( is_wp_error( $form ) ) {
			return $form;
		}
		$id = ( new SubmissionService() )->create( $form, wp_get_current_user(), $this->array_param( $request, 'values' ) );
		if ( is_wp_error( $id ) ) {
			return $id;
		}
		return $this->respond( ( new SubmissionRepository() )->find( $id ), 201 );
	}

	/**
	 * GET /portal/submissions/{id}
	 *
	 * @param WP_REST_Request $request Request.
	 * @return mixed
	 */
	public function get_submission( WP_REST_Request $request ) {
		$item = ( new SubmissionRepository() )->find( (int) $request['id'] );
		if ( ! $item || ! $this->can_view( $item ) ) {
			return new WP_Error( 'cs_not_found', __( 'Submission not found.', 'contact-sync' ), array( 'status' => 404 ) );
		}
		return $this->respond( $item );
	}

	/**
	 * POST /portal/imports/validate — dry run used by the preview step.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return mixed
	 */
	public function validate_import( WP_REST_Request $request ) {
		$form = $this->form();
		if ( is_wp_error( $form ) ) {
			return $form;
		}
		$rows = $this->array_param( $request, 'rows' );
		$max  = (int) \ContactSync\Support\Settings::get( 'security.max_csv_rows', 1000 );
		if ( count( $rows ) > $max ) {
			/* translators: %d: row limit */
			return new WP_Error( 'cs_too_many_rows', sprintf( __( 'A single import is limited to %d rows. Split the file and try again.', 'contact-sync' ), $max ), array( 'status' => 400 ) );
		}
		return $this->respond( array( 'rows' => ( new CsvImporter() )->validate( $form, $rows ) ) );
	}

	/**
	 * POST /portal/imports
	 *
	 * @param WP_REST_Request $request Request.
	 * @return mixed
	 */
	public function create_import( WP_REST_Request $request ) {
		$form = $this->form();
		if ( is_wp_error( $form ) ) {
			return $form;
		}
		return $this->respond(
			( new CsvImporter() )->import( $form, wp_get_current_user(), $this->array_param( $request, 'rows' ), (string) $request['filename'] ),
			201
		);
	}

	/**
	 * GET /portal/imports
	 *
	 * @return mixed
	 */
	public function list_imports() {
		return $this->respond( ( new BatchRepository() )->for_rep( get_current_user_id() ) );
	}

	/**
	 * GET /portal/imports/{id}
	 *
	 * @param WP_REST_Request $request Request.
	 * @return mixed
	 */
	public function get_import( WP_REST_Request $request ) {
		$batch = ( new BatchRepository() )->find( (int) $request['id'] );
		if ( ! $batch || ( get_current_user_id() !== $batch['rep_id'] && ! current_user_can( 'manage_contact_sync' ) ) ) {
			return new WP_Error( 'cs_not_found', __( 'Import not found.', 'contact-sync' ), array( 'status' => 404 ) );
		}
		return $this->respond( $batch );
	}

	/**
	 * GET /portal/sample-csv
	 *
	 * @return mixed
	 */
	public function sample_csv() {
		$form = $this->form();
		if ( is_wp_error( $form ) ) {
			return $form;
		}
		return $this->respond(
			array(
				'filename' => sanitize_file_name( strtolower( $form['title'] ) ) . '-template.csv',
				'content'  => SampleCsv::build( $form['schema'] ),
				'preview'  => SampleCsv::rows( $form['schema'] ),
			)
		);
	}

	/**
	 * Active portal form.
	 *
	 * @return array|WP_Error
	 */
	private function form() {
		$form = ( new FormRepository() )->get_default();
		if ( ! $form ) {
			return new WP_Error( 'cs_no_form', __( 'No lead form has been published yet. Please contact your administrator.', 'contact-sync' ), array( 'status' => 409 ) );
		}
		return $form;
	}

	/**
	 * Query scope for the current user.
	 *
	 * @param string $scope mine|agency.
	 * @return array|WP_Error
	 */
	private function scope( $scope ) {
		$user = wp_get_current_user();
		if ( 'agency' === $scope ) {
			$agency_id = RepService::agency_id( $user->ID );
			if ( ! $agency_id || ! current_user_can( 'cs_view_agency_leads' ) ) {
				return new WP_Error( 'rest_forbidden', __( 'You cannot view agency submissions.', 'contact-sync' ), array( 'status' => 403 ) );
			}
			return array( 'agency_id' => $agency_id );
		}
		return array( 'rep_id' => $user->ID );
	}

	/**
	 * Whether the current user may view a submission.
	 *
	 * @param array $item Submission.
	 * @return bool
	 */
	private function can_view( array $item ) {
		$user_id = get_current_user_id();
		if ( $item['rep']['id'] === $user_id ) {
			return true;
		}
		$agency_id = RepService::agency_id( $user_id );
		return $agency_id && $item['agency'] && $item['agency']['id'] === $agency_id && current_user_can( 'cs_view_agency_leads' );
	}
}
