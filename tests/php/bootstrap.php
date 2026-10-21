<?php
/**
 * Unit test bootstrap.
 *
 * Provides minimal stand-ins for the WordPress functions the tested classes call,
 * so the domain logic can be tested without a database. HTTP calls are answered
 * from the $GLOBALS['cs_http'] queue and every request is recorded in
 * $GLOBALS['cs_http_log'].
 *
 * @package ContactSync
 */

// phpcs:disable

define( 'ABSPATH', __DIR__ . '/' );
define( 'DAY_IN_SECONDS', 86400 );
define( 'HOUR_IN_SECONDS', 3600 );
define( 'MINUTE_IN_SECONDS', 60 );
define( 'AUTH_KEY', 'test-auth-key' );
define( 'SECURE_AUTH_SALT', 'test-salt' );

require dirname( __DIR__, 2 ) . '/vendor/autoload.php';

$GLOBALS['cs_options']    = array();
$GLOBALS['cs_transients'] = array();
$GLOBALS['cs_http']       = array();
$GLOBALS['cs_http_log']   = array();

class WP_Error {
	public $code;
	public $message;
	public $data;
	public function __construct( $code = '', $message = '', $data = '' ) {
		$this->code    = $code;
		$this->message = $message;
		$this->data    = $data;
	}
	public function get_error_code() { return $this->code; }
	public function get_error_message() { return $this->message; }
	public function get_error_data() { return $this->data; }
}

function is_wp_error( $thing ) { return $thing instanceof WP_Error; }
function __( $text ) { return $text; }
function esc_html__( $text ) { return $text; }
function apply_filters( $hook, $value ) { return $value; }
function do_action() {}
function wp_json_encode( $data, $flags = 0 ) { return json_encode( $data, $flags ); }
function untrailingslashit( $value ) { return rtrim( $value, '/\\' ); }
function get_bloginfo() { return 'Test Site'; }
function sanitize_text_field( $str ) { return trim( preg_replace( '/[\r\n\t ]+/', ' ', strip_tags( (string) $str ) ) ); }
function sanitize_textarea_field( $str ) { return trim( strip_tags( (string) $str ) ); }
function sanitize_key( $key ) { return preg_replace( '/[^a-z0-9_\-]/', '', strtolower( (string) $key ) ); }
function sanitize_title( $title ) { return trim( preg_replace( '/[^a-z0-9]+/', '-', strtolower( (string) $title ) ), '-' ); }
function sanitize_email( $email ) { return trim( (string) $email ); }
function sanitize_hex_color( $color ) { return preg_match( '/^#([A-Fa-f0-9]{3}){1,2}$/', $color ) ? $color : null; }
function esc_url_raw( $url ) { return filter_var( trim( (string) $url ), FILTER_SANITIZE_URL ); }
function is_email( $email ) { return false !== filter_var( $email, FILTER_VALIDATE_EMAIL ) ? $email : false; }
function wp_http_validate_url( $url ) { return filter_var( $url, FILTER_VALIDATE_URL ) ? $url : false; }
function absint( $n ) { return abs( (int) $n ); }
function wp_list_pluck( $list, $field, $index_key = null ) {
	$out = array();
	foreach ( $list as $row ) {
		$row = (array) $row;
		if ( null === $index_key ) {
			$out[] = $row[ $field ];
		} else {
			$out[ $row[ $index_key ] ] = $row[ $field ];
		}
	}
	return $out;
}
function wp_salt() { return 'salt'; }
function get_option( $name, $default = false ) { return $GLOBALS['cs_options'][ $name ] ?? $default; }
function update_option( $name, $value ) { $GLOBALS['cs_options'][ $name ] = $value; return true; }
function get_transient( $key ) { return $GLOBALS['cs_transients'][ $key ] ?? false; }
function set_transient( $key, $value ) { $GLOBALS['cs_transients'][ $key ] = $value; return true; }
function delete_transient( $key ) { unset( $GLOBALS['cs_transients'][ $key ] ); return true; }

function cs_test_http( $method, $url, $args ) {
	$GLOBALS['cs_http_log'][] = array( 'method' => $method, 'url' => $url, 'args' => $args );
	$next = array_shift( $GLOBALS['cs_http'] );
	if ( null === $next ) {
		return new WP_Error( 'http_request_failed', 'No mocked response' );
	}
	return $next;
}
function wp_remote_post( $url, $args = array() ) { return cs_test_http( 'POST', $url, $args ); }
function wp_remote_request( $url, $args = array() ) { return cs_test_http( $args['method'] ?? 'GET', $url, $args ); }
function wp_remote_retrieve_response_code( $r ) { return $r['response']['code'] ?? 0; }
function wp_remote_retrieve_body( $r ) { return $r['body'] ?? ''; }
function wp_remote_retrieve_header( $r, $name ) { return $r['headers'][ strtolower( $name ) ] ?? ''; }

/**
 * Build a mocked HTTP response.
 *
 * @param int          $code    Status.
 * @param array|string $body    Body (arrays are JSON encoded).
 * @param array        $headers Headers.
 * @return array
 */
function cs_response( $code, $body = '', $headers = array() ) {
	return array(
		'response' => array( 'code' => $code ),
		'body'     => is_array( $body ) ? json_encode( $body ) : $body,
		'headers'  => $headers,
	);
}
