<?php
/**
 * Lead payload mapping tests.
 *
 * @package ContactSync
 */

use ContactSync\Crm\LeadMapper;
use ContactSync\Forms\FormSchema;
use PHPUnit\Framework\TestCase;

class LeadMapperTest extends TestCase {

	protected function setUp(): void {
		$GLOBALS['cs_options'] = array();
	}

	private function schema( $static = array() ) {
		return FormSchema::sanitize(
			array(
				'settings' => array( 'staticValues' => $static ),
				'fields'   => array(
					array( 'type' => 'text', 'key' => 'first', 'label' => 'First', 'crm' => array( 'attribute' => 'firstname' ) ),
					array( 'type' => 'text', 'key' => 'last', 'label' => 'Last', 'crm' => array( 'attribute' => 'lastname' ) ),
					array( 'type' => 'email', 'key' => 'email', 'label' => 'Email', 'crm' => array( 'attribute' => 'emailaddress1' ) ),
					array(
						'type'    => 'select',
						'key'     => 'source',
						'label'   => 'Source',
						'options' => array( array( 'label' => 'Web', 'value' => '8' ) ),
						'crm'     => array( 'attribute' => 'leadsourcecode', 'type' => 'int' ),
					),
					array(
						'type'    => 'radio',
						'key'     => 'size',
						'label'   => 'Size',
						'options' => array( array( 'label' => 'Large account', 'value' => 'large' ) ),
						'crm'     => array( 'attribute' => 'new_size' ),
					),
					array( 'type' => 'checkbox', 'key' => 'optout', 'label' => 'Opt out', 'crm' => array( 'attribute' => 'donotemail', 'type' => 'bool' ) ),
					array( 'type' => 'text', 'key' => 'budget', 'label' => 'Budget' ),
				),
			)
		);
	}

	private function context( $agency = 'Northwind' ) {
		return array(
			'rep_name'    => 'Rita Rep',
			'rep_email'   => 'rita@northwind.com',
			'agency_name' => $agency,
			'product'     => 'Lead Portal',
		);
	}

	public function test_maps_and_casts_values() {
		$payload = LeadMapper::map(
			$this->schema(),
			array( 'first' => 'Ann', 'last' => 'Lee', 'email' => 'ann@x.com', 'source' => '8', 'size' => 'large', 'optout' => '1', 'budget' => '10k' ),
			$this->context()
		);
		$this->assertSame( 'Ann', $payload['firstname'] );
		$this->assertSame( 8, $payload['leadsourcecode'] );
		$this->assertSame( 'Large account', $payload['new_size'] );
		$this->assertTrue( $payload['donotemail'] );
		$this->assertSame( 'Lead from Northwind - Rita Rep', $payload['subject'] );
		$this->assertStringContainsString( 'Budget: 10k', $payload['description'] );
		$this->assertStringContainsString( 'Submitted via Lead Portal by Rita Rep (rita@northwind.com), Northwind.', $payload['description'] );
	}

	public function test_independent_rep_and_lastname_fallback() {
		$payload = LeadMapper::map( $this->schema(), array( 'email' => 'ann@x.com' ), $this->context( null ) );
		$this->assertSame( 'ann@x.com', $payload['lastname'] );
		$this->assertSame( 'Lead from Independent - Rita Rep', $payload['subject'] );
	}

	public function test_static_values_and_attribution_columns() {
		$GLOBALS['cs_options']['contact_sync_settings'] = array(
			'sync' => array(
				'agency_attribute' => 'new_agency',
				'rep_email_attr'   => 'new_repemail',
				'append_to_notes'  => false,
			),
		);
		$payload = LeadMapper::map(
			$this->schema( array( array( 'attribute' => 'leadqualitycode', 'value' => '2', 'type' => 'int' ) ) ),
			array( 'last' => 'Lee' ),
			$this->context()
		);
		$this->assertSame( 2, $payload['leadqualitycode'] );
		$this->assertSame( 'Northwind', $payload['new_agency'] );
		$this->assertSame( 'rita@northwind.com', $payload['new_repemail'] );
		$this->assertArrayNotHasKey( 'description', $payload );
	}

	public function test_description_is_truncated() {
		$payload = LeadMapper::map( $this->schema(), array( 'last' => 'Lee', 'budget' => str_repeat( 'x', 3000 ) ), $this->context() );
		$this->assertSame( LeadMapper::DESCRIPTION_MAX, mb_strlen( $payload['description'] ) );
	}
}
