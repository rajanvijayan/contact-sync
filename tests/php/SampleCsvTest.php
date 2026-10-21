<?php
/**
 * Sample CSV tests.
 *
 * @package ContactSync
 */

use ContactSync\Forms\FormSchema;
use ContactSync\Import\SampleCsv;
use PHPUnit\Framework\TestCase;

class SampleCsvTest extends TestCase {

	public function test_starter_form_template() {
		$data = SampleCsv::rows( FormSchema::starter() );
		$this->assertSame( array( 'first_name', 'last_name', 'email', 'phone', 'company', 'job_title', 'interest', 'interest_other', 'timeframe', 'notes' ), $data['headers'] );
		$this->assertCount( 2, $data['rows'] );

		$first  = array_combine( $data['headers'], $data['rows'][0] );
		$second = array_combine( $data['headers'], $data['rows'][1] );

		// Conditional "please specify" only filled when the example picks "Other".
		$this->assertSame( 'New installation', $first['interest'] );
		$this->assertSame( '', $first['interest_other'] );
		$this->assertSame( 'Other', $second['interest'] );
		$this->assertNotSame( '', $second['interest_other'] );
		$this->assertSame( 'jane.cooper@example.com', $first['email'] );
	}

	public function test_csv_has_bom_and_header() {
		$csv = SampleCsv::build( FormSchema::starter() );
		$this->assertStringStartsWith( "\xEF\xBB\xBFfirst_name,last_name,email", $csv );
	}
}
