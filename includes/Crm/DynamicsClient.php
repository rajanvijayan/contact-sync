<?php
/**
 * Dynamics 365 / Dataverse Web API client.
 *
 * @package ContactSync
 */

namespace ContactSync\Crm;

use ContactSync\Support\Settings;

defined( 'ABSPATH' ) || exit;

/**
 * Minimal Web API client for the operations the plugin needs.
 */
class DynamicsClient {

	/**
	 * Token provider.
	 *
	 * @var TokenProvider
	 */
	private $tokens;

	/**
	 * Constructor.
	 *
	 * @param TokenProvider|null $tokens Token provider.
	 */
	public function __construct( ?TokenProvider $tokens = null ) {
		$this->tokens = $tokens ? $tokens : new TokenProvider();
	}

	/**
	 * Identity of the application user (connection test).
	 *
	 * @return array UserId, BusinessUnitId, OrganizationId.
	 * @throws CrmException On failure.
	 */
	public function who_am_i() {
		return $this->request( 'GET', 'WhoAmI' )['body'];
	}

	/**
	 * Create a lead.
	 *
	 * @param array $payload Attribute => value.
	 * @return string New lead ID.
	 * @throws CrmException On failure.
	 */
	public function create_lead( array $payload ) {
		$response = $this->request( 'POST', 'leads?$select=leadid', $payload, array( 'Prefer' => 'return=representation' ) );

		if ( ! empty( $response['body']['leadid'] ) ) {
			return $response['body']['leadid'];
		}
		// Without return=representation support, the ID is in the OData-EntityId header.
		if ( preg_match( '/\(([0-9a-f-]{36})\)/i', (string) $response['headers']['odata-entityid'], $m ) ) {
			return $m[1];
		}
		throw new CrmException( __( 'Lead was created but no ID was returned.', 'contact-sync' ), $response['status'], false );
	}

	/**
	 * Find an open lead by email.
	 *
	 * @param string $email Email.
	 * @return string|null Lead ID.
	 * @throws CrmException On failure.
	 */
	public function find_lead_by_email( $email ) {
		$filter   = sprintf( "emailaddress1 eq '%s' and statecode eq 0", str_replace( "'", "''", $email ) );
		$response = $this->request( 'GET', 'leads?$select=leadid&$top=1&$filter=' . rawurlencode( $filter ) );
		return $response['body']['value'][0]['leadid'] ?? null;
	}

	/**
	 * Perform a Web API request. Retries once with a fresh token on 401.
	 *
	 * @param string $method  HTTP method.
	 * @param string $path    Path relative to the API root.
	 * @param array  $body    JSON body.
	 * @param array  $headers Extra headers.
	 * @param bool   $retried Internal.
	 * @return array status, body, headers, raw.
	 * @throws CrmException On failure.
	 */
	public function request( $method, $path, ?array $body = null, array $headers = array(), $retried = false ) {
		$config = Settings::get( 'dynamics' );
		$url    = untrailingslashit( $config['org_url'] ) . '/api/data/v' . $config['api_version'] . '/' . ltrim( $path, '/' );

		$args = array(
			'method'  => $method,
			'timeout' => 30,
			'headers' => array_merge(
				array(
					'Authorization'    => 'Bearer ' . $this->tokens->token(),
					'Accept'           => 'application/json',
					'OData-MaxVersion' => '4.0',
					'OData-Version'    => '4.0',
				),
				$headers
			),
		);
		if ( null !== $body ) {
			$args['headers']['Content-Type'] = 'application/json; charset=utf-8';
			$args['body']                    = wp_json_encode( $body );
		}

		$response = wp_remote_request( $url, $args );

		if ( is_wp_error( $response ) ) {
			/* translators: %s: error message */
			throw new CrmException( sprintf( __( 'Could not reach Dynamics 365: %s', 'contact-sync' ), $response->get_error_message() ), 0, true );
		}

		$status = (int) wp_remote_retrieve_response_code( $response );
		$raw    = (string) wp_remote_retrieve_body( $response );

		if ( 401 === $status && ! $retried ) {
			$this->tokens->clear();
			return $this->request( $method, $path, $body, $headers, true );
		}

		if ( $status < 200 || $status >= 300 ) {
			throw new CrmException( self::error_message( $status, $raw ), $status, self::retryable( $status ), $raw );
		}

		$decoded = '' === $raw ? array() : json_decode( $raw, true );
		return array(
			'status'  => $status,
			'body'    => is_array( $decoded ) ? $decoded : array(),
			'headers' => array(
				'odata-entityid' => wp_remote_retrieve_header( $response, 'odata-entityid' ),
			),
			'raw'     => $raw,
		);
	}

	/**
	 * Whether a status code is worth retrying.
	 *
	 * @param int $status HTTP status.
	 * @return bool
	 */
	public static function retryable( $status ) {
		return 0 === $status || 408 === $status || 429 === $status || $status >= 500;
	}

	/**
	 * Human readable error from an OData error response.
	 *
	 * @param int    $status HTTP status.
	 * @param string $raw    Body.
	 * @return string
	 */
	public static function error_message( $status, $raw ) {
		$decoded = json_decode( $raw, true );
		$message = $decoded['error']['message'] ?? '';
		if ( '' === $message ) {
			switch ( $status ) {
				case 401:
					$message = __( 'Unauthorized. Check the client ID, secret and that the application user exists in Dynamics.', 'contact-sync' );
					break;
				case 403:
					$message = __( 'Forbidden. The application user needs a security role that can create leads.', 'contact-sync' );
					break;
				case 404:
					$message = __( 'Not found. Check the organization URL and API version.', 'contact-sync' );
					break;
				case 429:
					$message = __( 'Rate limited by Dynamics 365. The request will be retried.', 'contact-sync' );
					break;
				default:
					/* translators: %d: HTTP status */
					$message = sprintf( __( 'Dynamics 365 returned HTTP %d.', 'contact-sync' ), $status );
			}
		}
		return $message;
	}
}
