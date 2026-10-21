<?php
/**
 * REST base controller.
 *
 * @package ContactSync
 */

namespace ContactSync\Rest;

use ContactSync\Reps\RepService;
use ContactSync\Roles;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

defined( 'ABSPATH' ) || exit;

/**
 * Shared helpers for plugin REST controllers.
 */
abstract class Controller {

	const NS = 'contact-sync/v1';

	/**
	 * Register routes.
	 */
	abstract public function routes();

	/**
	 * Register a route under the plugin namespace.
	 *
	 * @param string $route Route.
	 * @param array  $args  Endpoint definitions.
	 */
	protected function route( $route, array $args ) {
		register_rest_route( self::NS, $route, $args );
	}

	/**
	 * Permission: plugin administrators.
	 *
	 * @return bool
	 */
	public function can_manage() {
		return current_user_can( Roles::CAP_MANAGE );
	}

	/**
	 * Permission: active portal users (reps, managers and admins).
	 *
	 * @return bool|WP_Error
	 */
	public function can_submit() {
		$user = wp_get_current_user();
		if ( ! $user->exists() ) {
			return new WP_Error( 'rest_not_logged_in', __( 'Your session has expired. Please sign in again.', 'contact-sync' ), array( 'status' => 401 ) );
		}
		if ( ! user_can( $user, Roles::CAP_SUBMIT ) || RepService::STATUS_ACTIVE !== RepService::status( $user->ID ) ) {
			return new WP_Error( 'rest_forbidden', __( 'You do not have access to the portal.', 'contact-sync' ), array( 'status' => 403 ) );
		}
		return true;
	}

	/**
	 * Wrap a result, passing WP_Error through.
	 *
	 * @param mixed $data   Data or error.
	 * @param int   $status Status.
	 * @return WP_REST_Response|WP_Error
	 */
	protected function respond( $data, $status = 200 ) {
		if ( is_wp_error( $data ) ) {
			return $data;
		}
		return new WP_REST_Response( $data, $status );
	}

	/**
	 * Paginated list response with total headers.
	 *
	 * @param array $result   items/total.
	 * @param int   $per_page Page size.
	 * @return WP_REST_Response
	 */
	protected function paginated( array $result, $per_page ) {
		$response = new WP_REST_Response(
			array(
				'items' => $result['items'],
				'total' => $result['total'],
				'pages' => (int) ceil( $result['total'] / max( 1, $per_page ) ),
			)
		);
		return $response;
	}

	/**
	 * Common pagination args.
	 *
	 * @return array
	 */
	protected function pagination_args() {
		return array(
			'page'     => array(
				'type'    => 'integer',
				'default' => 1,
				'minimum' => 1,
			),
			'per_page' => array(
				'type'    => 'integer',
				'default' => 20,
				'minimum' => 1,
				'maximum' => 100,
			),
		);
	}

	/**
	 * Read a JSON body param as array.
	 *
	 * @param WP_REST_Request $request Request.
	 * @param string          $key     Key.
	 * @return array
	 */
	protected function array_param( WP_REST_Request $request, $key ) {
		$value = $request->get_param( $key );
		return is_array( $value ) ? $value : array();
	}

	/**
	 * Sanitise a CSV cell against spreadsheet formula injection.
	 *
	 * @param mixed $value Value.
	 * @return string
	 */
	public static function csv_safe( $value ) {
		$value = is_array( $value ) ? implode( '; ', $value ) : (string) $value;
		if ( '' !== $value && in_array( $value[0], array( '=', '+', '-', '@', "\t", "\r" ), true ) ) {
			$value = "'" . $value;
		}
		return $value;
	}

	/**
	 * Encode rows as CSV.
	 *
	 * @param array   $headers Header row.
	 * @param array[] $rows    Rows.
	 * @return string
	 */
	protected static function to_csv( array $headers, array $rows ) {
		$handle = fopen( 'php://temp', 'r+' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen
		fputcsv( $handle, $headers, ',', '"', '' );
		foreach ( $rows as $row ) {
			fputcsv( $handle, array_map( array( __CLASS__, 'csv_safe' ), $row ), ',', '"', '' );
		}
		rewind( $handle );
		$csv = stream_get_contents( $handle );
		fclose( $handle ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
		return "\xEF\xBB\xBF" . $csv;
	}
}
