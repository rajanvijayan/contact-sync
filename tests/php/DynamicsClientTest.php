<?php
/**
 * Dynamics client tests with mocked HTTP.
 *
 * @package ContactSync
 */

use ContactSync\Crm\CrmException;
use ContactSync\Crm\DynamicsClient;
use ContactSync\Support\Crypto;
use PHPUnit\Framework\TestCase;

class DynamicsClientTest extends TestCase {

	protected function setUp(): void {
		$GLOBALS['cs_transients'] = array();
		$GLOBALS['cs_http']       = array();
		$GLOBALS['cs_http_log']   = array();
		$GLOBALS['cs_options']    = array(
			'contact_sync_settings' => array(
				'dynamics' => array(
					'org_url'       => 'https://org.crm.dynamics.com',
					'tenant_id'     => 'tenant',
					'client_id'     => 'client',
					'client_secret' => Crypto::encrypt( 's3cret' ),
					'api_version'   => '9.2',
				),
			),
		);
	}

	private function token( $value = 'tok' ) {
		return cs_response( 200, array( 'access_token' => $value, 'expires_in' => 3600 ) );
	}

	public function test_secret_round_trip() {
		$encrypted = Crypto::encrypt( 'value' );
		$this->assertStringStartsWith( 'csenc:', $encrypted );
		$this->assertSame( 'value', Crypto::decrypt( $encrypted ) );
	}

	public function test_create_lead_requests_token_then_posts() {
		$GLOBALS['cs_http'] = array( $this->token(), cs_response( 201, array( 'leadid' => 'abc-123' ) ) );

		$id = ( new DynamicsClient() )->create_lead( array( 'lastname' => 'Lee' ) );

		$this->assertSame( 'abc-123', $id );
		$this->assertSame( 'https://login.microsoftonline.com/tenant/oauth2/v2.0/token', $GLOBALS['cs_http_log'][0]['url'] );
		$this->assertSame( 's3cret', $GLOBALS['cs_http_log'][0]['args']['body']['client_secret'] );
		$this->assertSame( 'https://org.crm.dynamics.com/.default', $GLOBALS['cs_http_log'][0]['args']['body']['scope'] );
		$post = $GLOBALS['cs_http_log'][1];
		$this->assertSame( 'https://org.crm.dynamics.com/api/data/v9.2/leads?$select=leadid', $post['url'] );
		$this->assertSame( 'Bearer tok', $post['args']['headers']['Authorization'] );
		$this->assertSame( '{"lastname":"Lee"}', $post['args']['body'] );
	}

	public function test_token_is_cached() {
		$GLOBALS['cs_http'] = array( $this->token(), cs_response( 201, array( 'leadid' => '1' ) ), cs_response( 201, array( 'leadid' => '2' ) ) );
		$client             = new DynamicsClient();
		$client->create_lead( array() );
		$client->create_lead( array() );
		$this->assertCount( 3, $GLOBALS['cs_http_log'] );
	}

	public function test_lead_id_from_entity_header() {
		$GLOBALS['cs_http'] = array( $this->token(), cs_response( 204, '', array( 'odata-entityid' => 'https://org/api/data/v9.2/leads(11111111-2222-3333-4444-555555555555)' ) ) );
		$this->assertSame( '11111111-2222-3333-4444-555555555555', ( new DynamicsClient() )->create_lead( array() ) );
	}

	public function test_401_refreshes_token_once() {
		$GLOBALS['cs_http'] = array( $this->token( 'old' ), cs_response( 401 ), $this->token( 'new' ), cs_response( 201, array( 'leadid' => 'x' ) ) );
		$this->assertSame( 'x', ( new DynamicsClient() )->create_lead( array() ) );
		$this->assertSame( 'Bearer new', $GLOBALS['cs_http_log'][3]['args']['headers']['Authorization'] );
	}

	public function test_validation_error_is_not_retryable() {
		$GLOBALS['cs_http'] = array( $this->token(), cs_response( 400, array( 'error' => array( 'message' => 'lastname is required' ) ) ) );
		try {
			( new DynamicsClient() )->create_lead( array() );
			$this->fail( 'Expected exception' );
		} catch ( CrmException $e ) {
			$this->assertSame( 'lastname is required', $e->getMessage() );
			$this->assertSame( 400, $e->status );
			$this->assertFalse( $e->retryable );
		}
	}

	public function test_server_errors_and_throttling_are_retryable() {
		foreach ( array( 429, 500, 503 ) as $code ) {
			$this->assertTrue( DynamicsClient::retryable( $code ), (string) $code );
		}
		$this->assertFalse( DynamicsClient::retryable( 403 ) );
	}

	public function test_auth_failure_message() {
		$GLOBALS['cs_http'] = array( cs_response( 401, array( 'error' => 'invalid_client', 'error_description' => "AADSTS7000215: Invalid client secret provided.\r\nTrace ID: 123" ) ) );
		$this->expectException( CrmException::class );
		$this->expectExceptionMessage( 'Authentication failed: AADSTS7000215: Invalid client secret provided.' );
		( new DynamicsClient() )->who_am_i();
	}

	public function test_duplicate_lookup_escapes_quotes() {
		$GLOBALS['cs_http'] = array( $this->token(), cs_response( 200, array( 'value' => array() ) ) );
		$this->assertNull( ( new DynamicsClient() )->find_lead_by_email( "o'neil@x.com" ) );
		$this->assertStringContainsString( rawurlencode( "emailaddress1 eq 'o''neil@x.com'" ), $GLOBALS['cs_http_log'][1]['url'] );
	}
}
