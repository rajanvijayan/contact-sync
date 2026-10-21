<?php
/**
 * Server-side validation tests.
 *
 * @package ContactSync
 */

use ContactSync\Forms\FormSchema;
use ContactSync\Forms\Validator;
use PHPUnit\Framework\TestCase;

class ValidatorTest extends TestCase {

	private function schema() {
		return FormSchema::sanitize(
			array(
				'fields' => array(
					array( 'type' => 'text', 'key' => 'name', 'label' => 'Name', 'required' => true ),
					array( 'type' => 'email', 'key' => 'email', 'label' => 'Email', 'required' => true ),
					array(
						'type'    => 'select',
						'key'     => 'interest',
						'label'   => 'Interest',
						'options' => array(
							array( 'label' => 'New', 'value' => 'new' ),
							array( 'label' => 'Other', 'value' => 'other' ),
						),
					),
					array(
						'type'       => 'text',
						'key'        => 'other',
						'label'      => 'Other',
						'required'   => true,
						'conditions' => array(
							'enabled' => true,
							'rules'   => array( array( 'field' => 'interest', 'operator' => 'equals', 'value' => 'other' ) ),
						),
					),
					array( 'type' => 'number', 'key' => 'seats', 'label' => 'Seats', 'validation' => array( 'min' => 1, 'max' => 100 ) ),
					array(
						'type'    => 'checkboxes',
						'key'     => 'channels',
						'label'   => 'Channels',
						'options' => array(
							array( 'label' => 'Email', 'value' => 'email' ),
							array( 'label' => 'Phone', 'value' => 'phone' ),
						),
					),
					array( 'type' => 'checkbox', 'key' => 'consent', 'label' => 'Consent' ),
					array( 'type' => 'date', 'key' => 'when', 'label' => 'When' ),
					array( 'type' => 'text', 'key' => 'code', 'label' => 'Code', 'validation' => array( 'pattern' => '[A-Z]{2}[0-9]{2}' ) ),
					array( 'type' => 'hidden', 'key' => 'campaign', 'default' => 'spring' ),
				),
			)
		);
	}

	public function test_required_and_format_errors() {
		$result = Validator::validate( $this->schema(), array( 'email' => 'nope', 'seats' => '500', 'code' => 'ab12' ) );
		$this->assertArrayHasKey( 'name', $result['errors'] );
		$this->assertArrayHasKey( 'email', $result['errors'] );
		$this->assertArrayHasKey( 'seats', $result['errors'] );
		$this->assertArrayHasKey( 'code', $result['errors'] );
	}

	public function test_hidden_conditional_field_is_skipped_and_dropped() {
		$result = Validator::validate(
			$this->schema(),
			array( 'name' => 'Ann', 'email' => 'ann@example.com', 'interest' => 'new', 'other' => 'should be dropped' )
		);
		$this->assertSame( array(), $result['errors'] );
		$this->assertArrayNotHasKey( 'other', $result['values'] );
	}

	public function test_visible_conditional_field_is_required() {
		$result = Validator::validate( $this->schema(), array( 'name' => 'Ann', 'email' => 'ann@example.com', 'interest' => 'other' ) );
		$this->assertArrayHasKey( 'other', $result['errors'] );
	}

	public function test_hidden_field_uses_default_value() {
		$result = Validator::validate( $this->schema(), array( 'name' => 'Ann', 'email' => 'ann@example.com' ) );
		$this->assertSame( 'spring', $result['values']['campaign'] );
	}

	public function test_invalid_option_rejected_in_strict_mode() {
		$result = Validator::validate( $this->schema(), array( 'name' => 'A', 'email' => 'a@b.co', 'interest' => 'Other' ) );
		$this->assertArrayHasKey( 'interest', $result['errors'] );
	}

	public function test_lenient_mode_accepts_labels_lists_and_yes() {
		$result = Validator::validate(
			$this->schema(),
			array(
				'name'     => 'Ann',
				'email'    => 'ANN@Example.com',
				'interest' => 'Other',
				'other'    => 'Custom',
				'channels' => 'Email; phone',
				'consent'  => 'yes',
				'when'     => '31 March 2026',
				'seats'    => '1,5',
			),
			true
		);
		$this->assertSame( array(), $result['errors'] );
		$this->assertSame( 'other', $result['values']['interest'] );
		$this->assertSame( array( 'email', 'phone' ), $result['values']['channels'] );
		$this->assertSame( '1', $result['values']['consent'] );
		$this->assertSame( '2026-03-31', $result['values']['when'] );
		$this->assertSame( 'ann@example.com', $result['values']['email'] );
		$this->assertSame( '15', $result['values']['seats'] );
	}

	public function test_schema_sanitize_dedupes_keys_and_drops_dangling_rules() {
		$schema = FormSchema::sanitize(
			array(
				'fields' => array(
					array( 'type' => 'text', 'key' => 'name' ),
					array( 'type' => 'text', 'key' => 'name' ),
					array(
						'type'       => 'text',
						'key'        => 'x',
						'conditions' => array(
							'enabled' => true,
							'rules'   => array( array( 'field' => 'missing', 'operator' => 'equals', 'value' => '1' ) ),
						),
					),
					array( 'type' => 'script', 'key' => 'evil' ),
				),
			)
		);
		$this->assertSame( array( 'name', 'name_2', 'x' ), array_column( $schema['fields'], 'key' ) );
		$this->assertFalse( $schema['fields'][2]['conditions']['enabled'] );
		$this->assertSame( array(), $schema['fields'][2]['conditions']['rules'] );
	}

	public function test_invalid_pattern_is_removed() {
		$schema = FormSchema::sanitize( array( 'fields' => array( array( 'type' => 'text', 'key' => 'a', 'validation' => array( 'pattern' => '([' ) ) ) ) );
		$this->assertArrayNotHasKey( 'pattern', $schema['fields'][0]['validation'] );
	}
}
