<?php
/**
 * CRM error.
 *
 * @package ContactSync
 */

namespace ContactSync\Crm;

defined( 'ABSPATH' ) || exit;

/**
 * Error raised by the Dynamics client, carrying HTTP details and whether a retry may help.
 */
class CrmException extends \Exception {

	/**
	 * HTTP status (0 for network errors).
	 *
	 * @var int
	 */
	public $status;

	/**
	 * Whether retrying later could succeed.
	 *
	 * @var bool
	 */
	public $retryable;

	/**
	 * Raw response body.
	 *
	 * @var string
	 */
	public $body;

	/**
	 * Constructor.
	 *
	 * @param string $message   Message.
	 * @param int    $status    HTTP status.
	 * @param bool   $retryable Retryable.
	 * @param string $body      Response body.
	 */
	public function __construct( $message, $status = 0, $retryable = false, $body = '' ) {
		parent::__construct( $message );
		$this->status    = (int) $status;
		$this->retryable = (bool) $retryable;
		$this->body      = (string) $body;
	}
}
