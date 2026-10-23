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
		$form = ( new FormRepository() )->create( $data );
		if ( ! is_wp_error( $form ) ) {
			/* translators: %s: form title */
			$this->audit( $form, 'form_created', 'form', $form['id'], sprintf( __( 'Created form %s.', 'contact-sync' ), $form['title'] ) );
		}
		return $this->respond( $form, 201 );
	}

	/**
	 * PUT /forms/{id}
	 *
	 * @param WP_REST_Request $request Request.
	 * @return mixed
	 */
	public function update( WP_REST_Request $request ) {
		$repo   = new FormRepository();
		$before = $repo->find( (int) $request['id'] );
		$data   = (array) $request->get_json_params();
		$form   = $repo->update( (int) $request['id'], $data );
		if ( ! is_wp_error( $form ) && $before ) {
			if ( ! empty( $data['is_default'] ) && ! $before['is_default'] ) {
				/* translators: %s: form title */
				$this->audit( $form, 'form_published', 'form', $form['id'], sprintf( __( 'Made form %s live in the portal.', 'contact-sync' ), $form['title'] ) );
			} elseif ( $form['version'] !== $before['version'] || $form['title'] !== $before['title'] || $form['status'] !== $before['status'] ) {
				/* translators: 1: form title, 2: version */
				$this->audit( $form, 'form_updated', 'form', $form['id'], sprintf( __( 'Saved form %1$s (version %2$d).', 'contact-sync' ), $form['title'], $form['version'] ) );
			}
		}
		return $this->respond( $form );
	}

	/**
	 * DELETE /forms/{id}
	 *
	 * @param WP_REST_Request $request Request.
	 * @return mixed
	 */
	public function destroy( WP_REST_Request $request ) {
		$repo   = new FormRepository();
		$form   = $repo->find( (int) $request['id'] );
		$result = $repo->delete( (int) $request['id'] );
		if ( $form && ! is_wp_error( $result ) ) {
			$archived = (bool) $repo->find( $form['id'] );
			$this->audit(
				$result,
				$archived ? 'form_archived' : 'form_deleted',
				'form',
				$form['id'],
				/* translators: %s: form title */
				sprintf( $archived ? __( 'Archived form %s.', 'contact-sync' ) : __( 'Deleted form %s.', 'contact-sync' ), $form['title'] )
			);
		}
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
		$copy = $repo->create(
			array(
				/* translators: %s: form title */
				'title'  => sprintf( __( '%s (copy)', 'contact-sync' ), $form['title'] ),
				'schema' => $form['schema'],
			)
		);
		if ( ! is_wp_error( $copy ) ) {
			/* translators: 1: source form title, 2: new form title */
			$this->audit( $copy, 'form_duplicated', 'form', $copy['id'], sprintf( __( 'Duplicated form %1$s as %2$s.', 'contact-sync' ), $form['title'], $copy['title'] ) );
		}
		return $this->respond( $copy, 201 );
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
