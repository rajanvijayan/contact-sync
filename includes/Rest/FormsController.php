<?php
/**
 * Form builder endpoints.
 *
 * @package ContactSync
 */

namespace ContactSync\Rest;

use ContactSync\Forms\FormRepository;
use ContactSync\Import\SampleCsv;
use WP_Error;
use WP_REST_Request;
use WP_REST_Server;

defined( 'ABSPATH' ) || exit;

/**
 * Admin CRUD for forms.
 */
class FormsController extends Controller {

	/**
	 * Register routes.
	 */
	public function routes() {
		$perm = array( $this, 'can_manage' );
		$this->route(
			'/forms',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'index' ),
					'permission_callback' => $perm,
				),
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'create' ),
					'permission_callback' => $perm,
				),
			)
		);
		$this->route(
			'/forms/(?P<id>\d+)',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'show' ),
					'permission_callback' => $perm,
				),
				array(
					'methods'             => WP_REST_Server::EDITABLE,
					'callback'            => array( $this, 'update' ),
					'permission_callback' => $perm,
				),
				array(
					'methods'             => WP_REST_Server::DELETABLE,
					'callback'            => array( $this, 'destroy' ),
					'permission_callback' => $perm,
				),
			)
		);
		$this->route(
			'/forms/(?P<id>\d+)/duplicate',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'duplicate' ),
				'permission_callback' => $perm,
			)
		);
		$this->route(
			'/forms/(?P<id>\d+)/sample-csv',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'sample_csv' ),
				'permission_callback' => $perm,
			)
		);
	}

	/**
	 * GET /forms
	 *
	 * @return mixed
	 */
	public function index() {
		return $this->respond( ( new FormRepository() )->all() );
	}

	/**
	 * GET /forms/{id}
	 *
	 * @param WP_REST_Request $request Request.
	 * @return mixed
	 */
	public function show( WP_REST_Request $request ) {
		$form = ( new FormRepository() )->find( (int) $request['id'] );
		return $form ? $this->respond( $form ) : new WP_Error( 'cs_not_found', __( 'Form not found.', 'contact-sync' ), array( 'status' => 404 ) );
	}

	/**
	 * POST /forms
	 *
	 * @param WP_REST_Request $request Request.
	 * @return mixed
	 */
	public function create( WP_REST_Request $request ) {
		$data = (array) $request->get_json_params();
		if ( empty( $data['schema'] ) ) {
			$data['schema'] = array(
				'settings' => array( 'submitLabel' => __( 'Submit lead', 'contact-sync' ) ),
				'fields'   => array(),
			);
		}
		return $this->respond( ( new FormRepository() )->create( $data ), 201 );
	}

	/**
	 * PUT /forms/{id}
	 *
	 * @param WP_REST_Request $request Request.
	 * @return mixed
	 */
	public function update( WP_REST_Request $request ) {
		return $this->respond( ( new FormRepository() )->update( (int) $request['id'], (array) $request->get_json_params() ) );
	}

	/**
	 * DELETE /forms/{id}
	 *
	 * @param WP_REST_Request $request Request.
	 * @return mixed
	 */
	public function destroy( WP_REST_Request $request ) {
		$result = ( new FormRepository() )->delete( (int) $request['id'] );
		return is_wp_error( $result ) ? $result : $this->respond( array( 'deleted' => true ) );
	}

	/**
	 * POST /forms/{id}/duplicate
	 *
	 * @param WP_REST_Request $request Request.
	 * @return mixed
	 */
	public function duplicate( WP_REST_Request $request ) {
		$repo = new FormRepository();
		$form = $repo->find( (int) $request['id'] );
		if ( ! $form ) {
			return new WP_Error( 'cs_not_found', __( 'Form not found.', 'contact-sync' ), array( 'status' => 404 ) );
		}
		return $this->respond(
			$repo->create(
				array(
					/* translators: %s: form title */
					'title'  => sprintf( __( '%s (copy)', 'contact-sync' ), $form['title'] ),
					'schema' => $form['schema'],
				)
			),
			201
		);
	}

	/**
	 * GET /forms/{id}/sample-csv
	 *
	 * @param WP_REST_Request $request Request.
	 * @return mixed
	 */
	public function sample_csv( WP_REST_Request $request ) {
		$form = ( new FormRepository() )->find( (int) $request['id'] );
		if ( ! $form ) {
			return new WP_Error( 'cs_not_found', __( 'Form not found.', 'contact-sync' ), array( 'status' => 404 ) );
		}
		return $this->respond(
			array(
				'filename' => sanitize_file_name( strtolower( $form['title'] ) ) . '-template.csv',
				'content'  => SampleCsv::build( $form['schema'] ),
			)
		);
	}
}
