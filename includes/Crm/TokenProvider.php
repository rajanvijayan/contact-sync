<?php
/**
 * OAuth token acquisition.
 *
 * @package ContactSync
 */

namespace ContactSync\Crm;

use ContactSync\Support\Settings;

defined( 'ABSPATH' ) || exit;

/**
 * Gets app-only access tokens from Microsoft Entra ID using the client credentials flow.
 */
class TokenProvider {

	const CACHE_KEY = 'contact_sync_token';

	/**
	 * Return a cached token or request a new one.
	 *
	 * @param bool $force Skip the cache.
	 * @return string
	 * @throws CrmException When the token request fails.
	 */
	public function token( $force = false ) {
		if ( ! $force ) {
			$cached = get_transient( self::CACHE_KEY );
			if ( $cached ) {
				return $cached;
			}
		}

		$config = Settings::get( 'dynamics' );
		if ( ! Settings::dynamics_configured() ) {
			throw new CrmException( __( 'The Dynamics 365 connection is not configured.', 'contact-sync' ), 0, false );
		}

		/**
		 * Filters the OAuth token endpoint, e.g. login.microsoftonline.us for US Government clouds.
		 *
		 * @param string $url       Token URL.
		 * @param string $tenant_id Tenant ID.
		 */
		$url      = apply_filters( 'contact_sync_token_url', sprintf( 'https://login.microsoftonline.com/%s/oauth2/v2.0/token', rawurlencode( $config['tenant_id'] ) ), $config['tenant_id'] );
		$response = wp_remote_post(
			$url,
			array(
				'timeout' => 20,
				'body'    => array(
					'grant_type'    => 'client_credentials',
					'client_id'     => $config['client_id'],
					'client_secret' => Settings::client_secret(),
					'scope'         => untrailingslashit( $config['org_url'] ) . '/.default',
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			/* translators: %s: error message */
			throw new CrmException( sprintf( __( 'Could not reach Microsoft sign-in: %s', 'contact-sync' ), $response->get_error_message() ), 0, true );
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$body = json_decode( wp_remote_retrieve_body( $response ), true );

		if ( 200 !== $code || empty( $body['access_token'] ) ) {
			$detail = $body['error_description'] ?? ( $body['error'] ?? __( 'Unknown error', 'contact-sync' ) );
			// Strip the trace/correlation lines Entra appends.
			$detail = trim( strtok( (string) $detail, "\r\n" ) );
			/* translators: %s: error from Microsoft */
			throw new CrmException( sprintf( __( 'Authentication failed: %s', 'contact-sync' ), $detail ), $code, $code >= 500 );
		}

		$ttl = max( 60, (int) ( $body['expires_in'] ?? 3600 ) - 120 );
		set_transient( self::CACHE_KEY, $body['access_token'], $ttl );
		return $body['access_token'];
	}

	/**
	 * Forget the cached token.
	 */
	public function clear() {
		delete_transient( self::CACHE_KEY );
	}
}
