<?php
/**
 * What reps receive from the portal API.
 *
 * @package ContactSync
 */

use ContactSync\Forms\FormSchema;
use ContactSync\Rest\PortalController;
use PHPUnit\Framework\TestCase;

class PortalPayloadTest extends TestCase {

	public function test_schema_drops_crm_mappings_and_fixed_values() {
		$schema = FormSchema::sanitize(
			array(
				'settings' => array( 'staticValues' => array( array( 'attribute' => 'leadsourcecode', 'value' => '8' ) ) ),
				'fields'   => array(
					array( 'type' => 'email', 'key' => 'email', 'label' => 'Email', 'crm' => array( 'attribute' => 'emailaddress1' ) ),
				),
			)
		);

		$portal = FormSchema::for_portal( $schema );

		$this->assertArrayNotHasKey( 'staticValues', $portal['settings'] );
		$this->assertArrayNotHasKey( 'crm', $portal['fields'][0] );
		$this->assertSame( 'email', $portal['fields'][0]['key'] );
	}

	public function test_submission_drops_crm_and_internal_fields() {
		$item = PortalController::for_rep(
			array(
				'id'          => 3,
				'status'      => 'synced',
				'crm_lead_id' => 'abc',
				'last_error'  => 'HTTP 400 from Dynamics',
				'attempts'    => 2,
				'reviewed_at' => null,
			)
		);

		$this->assertSame( array( 'id', 'status', 'reviewed_at' ), array_keys( $item ) );
	}
}
