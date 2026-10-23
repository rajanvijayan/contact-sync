<?php
/**
 * Lead volume reports.
 *
 * @package ContactSync
 */

namespace ContactSync\Reports;

use ContactSync\Support\Db;
use DateInterval;
use DateTimeImmutable;
use DateTimeZone;

defined( 'ABSPATH' ) || exit;

/**
 * Aggregates lead volume by agency and period for the admin Reports page and its exports.
 *
 * Dates are calendar days in the site timezone, so a lead submitted late in the
 * evening lands on the day the sales team saw it.
 */
class ReportService {

	const GROUPS   = array( 'day', 'week', 'month' );
	const MAX_DAYS = 731;

	/**
	 * Site timezone.
	 *
	 * @var DateTimeZone
	 */
	private $tz;

	/**
	 * Constructor.
	 */
	public function __construct() {
		$this->tz = wp_timezone();
	}

	/**
	 * Normalise request input into a valid range.
	 *
	 * @param string $from   Y-m-d start (site timezone).
	 * @param string $to     Y-m-d end, inclusive.
	 * @param string $group  day|week|month.
	 * @param string $agency Agency ID, "independent" or empty.
	 * @return array
	 */
	public function args( $from, $to, $group, $agency ) {
		$today = new DateTimeImmutable( 'today', $this->tz );
		$end   = $this->parse_date( $to ) ?? $today;
		$start = $this->parse_date( $from ) ?? $end->sub( new DateInterval( 'P29D' ) );
		if ( $start > $end ) {
			list( $start, $end ) = array( $end, $start );
		}
		if ( (int) $start->diff( $end )->days >= self::MAX_DAYS ) {
			$start = $end->sub( new DateInterval( 'P' . ( self::MAX_DAYS - 1 ) . 'D' ) );
		}
		$days = (int) $start->diff( $end )->days + 1;
		if ( ! in_array( $group, self::GROUPS, true ) ) {
			$group = $days > 120 ? 'month' : ( $days > 31 ? 'week' : 'day' );
		}
		if ( 'independent' !== $agency ) {
			$agency = absint( $agency ) ? absint( $agency ) : '';
		}
		return array(
			'from'   => $start,
			'to'     => $end,
			'days'   => $days,
			'group'  => $group,
			'agency' => $agency,
		);
	}

	/**
	 * Build the full report.
	 *
	 * @param array $args Output of args().
	 * @return array
	 */
	public function report( array $args ) {
		$prev_to   = $args['from']->sub( new DateInterval( 'P1D' ) );
		$prev_from = $prev_to->sub( new DateInterval( 'P' . ( $args['days'] - 1 ) . 'D' ) );

		$rows      = $this->rows( $args['from'], $args['to'], $args['agency'] );
		$prev_rows = $this->rows( $prev_from, $prev_to, $args['agency'] );
		$buckets   = $this->buckets( $args['from'], $args['to'], $args['group'] );
		$index     = array_flip( array_keys( $buckets ) );
		$names     = $this->agency_names();

		$blank  = array(
			'total'     => 0,
			'delivered' => 0,
			'pending'   => 0,
			'failed'    => 0,
			'duplicate' => 0,
		);
		$totals = $blank;
		$series = array();
		foreach ( $buckets as $key => $bounds ) {
			$series[ $key ] = array_merge( $bounds, $blank );
		}

		$agencies = array();
		if ( '' === $args['agency'] ) {
			foreach ( $names['active'] as $id => $name ) {
				$agencies[ $id ] = $this->agency_row( $id, $name, count( $buckets ) );
			}
		}

		$reps = array();
		foreach ( $rows as $row ) {
			$key = $this->bucket_key( $row['local'], $args['group'] );
			if ( ! isset( $series[ $key ] ) ) {
				continue;
			}
			$aid    = $row['agency_id'] ? (int) $row['agency_id'] : 0;
			$status = self::status_group( $row['sync_status'] );
			if ( ! isset( $agencies[ $aid ] ) ) {
				$agencies[ $aid ] = $this->agency_row( $aid, $names['all'][ $aid ] ?? null, count( $buckets ) );
			}
			++$totals['total'];
			++$totals[ $status ];
			++$series[ $key ]['total'];
			++$series[ $key ][ $status ];
			++$agencies[ $aid ]['total'];
			++$agencies[ $aid ][ $status ];
			++$agencies[ $aid ]['series'][ $index[ $key ] ];
			$agencies[ $aid ]['rep_ids'][ $row['rep_id'] ] = true;
			$reps[ $row['rep_id'] ]                        = true;
		}

		$prev_totals = array(
			'total'     => count( $prev_rows ),
			'delivered' => 0,
			'agencies'  => array(),
			'reps'      => array(),
		);
		foreach ( $prev_rows as $row ) {
			$aid = $row['agency_id'] ? (int) $row['agency_id'] : 0;
			if ( in_array( self::status_group( $row['sync_status'] ), array( 'delivered', 'duplicate' ), true ) ) {
				++$prev_totals['delivered'];
			}
			$prev_totals['agencies'][ $aid ]       = ( $prev_totals['agencies'][ $aid ] ?? 0 ) + 1;
			$prev_totals['reps'][ $row['rep_id'] ] = true;
		}

		foreach ( $agencies as $aid => &$agency ) {
			$agency['previous'] = $prev_totals['agencies'][ $aid ] ?? 0;
			$agency['share']    = $totals['total'] ? round( $agency['total'] / $totals['total'] * 100, 1 ) : 0;
			$agency['reps']     = count( $agency['rep_ids'] );
			unset( $agency['rep_ids'] );
		}
		unset( $agency );
		$agencies = array_values( $agencies );
		usort(
			$agencies,
			function ( $a, $b ) {
				$diff = $b['total'] <=> $a['total'];
				return 0 !== $diff ? $diff : strcasecmp( $a['name'], $b['name'] );
			}
		);

		$series = array_values( $series );
		$peak   = null;
		foreach ( $series as $point ) {
			if ( $point['total'] && ( ! $peak || $point['total'] > $peak['total'] ) ) {
				$peak = array(
					'start' => $point['start'],
					'end'   => $point['end'],
					'total' => $point['total'],
				);
			}
		}

		$sending = count(
			array_filter(
				$agencies,
				function ( $a ) {
					return $a['id'] && $a['total'] > 0;
				}
			)
		);

		return array(
			'range'    => array(
				'from'          => $args['from']->format( 'Y-m-d' ),
				'to'            => $args['to']->format( 'Y-m-d' ),
				'days'          => $args['days'],
				'group'         => $args['group'],
				'agency'        => $args['agency'],
				'previous_from' => $prev_from->format( 'Y-m-d' ),
				'previous_to'   => $prev_to->format( 'Y-m-d' ),
				'timezone'      => wp_timezone_string(),
			),
			'totals'   => array_merge(
				$totals,
				array(
					'reps'          => count( $reps ),
					'agencies'      => $sending,
					'agencies_all'  => count( $names['active'] ),
					'per_day'       => round( $totals['total'] / $args['days'], 1 ),
					'delivery_rate' => $totals['total'] ? round( ( $totals['delivered'] + $totals['duplicate'] ) / $totals['total'] * 100, 1 ) : null,
				)
			),
			'previous' => array(
				'total'         => $prev_totals['total'],
				'delivered'     => $prev_totals['delivered'],
				'reps'          => count( $prev_totals['reps'] ),
				'agencies'      => count( array_filter( array_keys( $prev_totals['agencies'] ) ) ),
				'per_day'       => round( $prev_totals['total'] / $args['days'], 1 ),
				'delivery_rate' => $prev_totals['total'] ? round( $prev_totals['delivered'] / $prev_totals['total'] * 100, 1 ) : null,
			),
			'series'   => $series,
			'agencies' => $agencies,
			'peak'     => $peak,
		);
	}

	/**
	 * Collapse sync statuses into the buckets leadership cares about.
	 *
	 * @param string $status Sync status.
	 * @return string delivered|pending|failed|duplicate
	 */
	public static function status_group( $status ) {
		switch ( $status ) {
			case 'synced':
				return 'delivered';
			case 'duplicate':
				return 'duplicate';
			case 'failed':
				return 'failed';
			default:
				return 'pending';
		}
	}

	/**
	 * Empty agency row.
	 *
	 * @param int         $id      Agency ID (0 for independent).
	 * @param string|null $name    Name.
	 * @param int         $periods Number of periods.
	 * @return array
	 */
	private function agency_row( $id, $name, $periods ) {
		if ( ! $id ) {
			$name = __( 'Independent reps', 'contact-sync' );
		} elseif ( null === $name ) {
			$name = __( 'Deleted agency', 'contact-sync' );
		}
		return array(
			'id'        => $id ? $id : null,
			'name'      => $name,
			'total'     => 0,
			'delivered' => 0,
			'pending'   => 0,
			'failed'    => 0,
			'duplicate' => 0,
			'series'    => array_fill( 0, $periods, 0 ),
			'rep_ids'   => array(),
		);
	}

	/**
	 * Agency names keyed by ID.
	 *
	 * @return array{all: array<int,string>, active: array<int,string>}
	 */
	private function agency_names() {
		global $wpdb;
		$table = Db::table( 'agencies' );
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery
		$rows   = $wpdb->get_results( "SELECT id, name, status FROM {$table} ORDER BY name ASC", ARRAY_A );
		$all    = array();
		$active = array();
		foreach ( $rows as $row ) {
			$all[ (int) $row['id'] ] = $row['name'];
			if ( 'active' === $row['status'] ) {
				$active[ (int) $row['id'] ] = $row['name'];
			}
		}
		return array(
			'all'    => $all,
			'active' => $active,
		);
	}

	/**
	 * Submissions created within a local date range.
	 *
	 * @param DateTimeImmutable $from   Start day.
	 * @param DateTimeImmutable $to     End day, inclusive.
	 * @param int|string        $agency Agency filter.
	 * @return array[] Rows with agency_id, rep_id, sync_status and local (Y-m-d).
	 */
	private function rows( DateTimeImmutable $from, DateTimeImmutable $to, $agency ) {
		global $wpdb;
		$utc    = new DateTimeZone( 'UTC' );
		$start  = $from->setTime( 0, 0 )->setTimezone( $utc )->format( 'Y-m-d H:i:s' );
		$end    = $to->add( new DateInterval( 'P1D' ) )->setTime( 0, 0 )->setTimezone( $utc )->format( 'Y-m-d H:i:s' );
		$subs   = Db::table( 'submissions' );
		$where  = 'created_at >= %s AND created_at < %s AND deleted_at IS NULL';
		$params = array( $start, $end );
		if ( 'independent' === $agency ) {
			$where .= ' AND agency_id IS NULL';
		} elseif ( $agency ) {
			$where   .= ' AND agency_id = %d';
			$params[] = (int) $agency;
		}
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.DirectDatabaseQuery
		$rows = $wpdb->get_results( $wpdb->prepare( "SELECT created_at, agency_id, rep_id, sync_status FROM {$subs} WHERE {$where}", $params ), ARRAY_A );

		foreach ( $rows as &$row ) {
			$row['local'] = ( new DateTimeImmutable( $row['created_at'], $utc ) )->setTimezone( $this->tz )->format( 'Y-m-d' );
		}
		unset( $row );
		return $rows;
	}

	/**
	 * Every period in the range, keyed by its canonical start date. Partial first and
	 * last periods carry start/end dates clamped to the range.
	 *
	 * @param DateTimeImmutable $from  Start.
	 * @param DateTimeImmutable $to    End.
	 * @param string            $group day|week|month.
	 * @return array<string,array{start: string, end: string}>
	 */
	private function buckets( DateTimeImmutable $from, DateTimeImmutable $to, $group ) {
		$buckets = array();
		$cursor  = new DateTimeImmutable( $this->bucket_key( $from->format( 'Y-m-d' ), $group ), $this->tz );
		$step    = array(
			'day'   => 'P1D',
			'week'  => 'P7D',
			'month' => 'P1M',
		)[ $group ];
		while ( $cursor <= $to ) {
			$next = $cursor->add( new DateInterval( $step ) );
			$end  = $next->sub( new DateInterval( 'P1D' ) );

			$buckets[ $cursor->format( 'Y-m-d' ) ] = array(
				'start' => ( $cursor < $from ? $from : $cursor )->format( 'Y-m-d' ),
				'end'   => ( $end > $to ? $to : $end )->format( 'Y-m-d' ),
			);
			$cursor                                = $next;
		}
		return $buckets;
	}

	/**
	 * Period start for a local date.
	 *
	 * @param string $date  Y-m-d.
	 * @param string $group day|week|month.
	 * @return string Y-m-d.
	 */
	private function bucket_key( $date, $group ) {
		if ( 'month' === $group ) {
			return substr( $date, 0, 8 ) . '01';
		}
		if ( 'week' === $group ) {
			$day   = new DateTimeImmutable( $date, $this->tz );
			$start = (int) get_option( 'start_of_week', 1 );
			$back  = ( (int) $day->format( 'w' ) - $start + 7 ) % 7;
			return $day->sub( new DateInterval( 'P' . $back . 'D' ) )->format( 'Y-m-d' );
		}
		return $date;
	}

	/**
	 * Parse a Y-m-d string in the site timezone.
	 *
	 * @param string $value Date.
	 * @return DateTimeImmutable|null
	 */
	private function parse_date( $value ) {
		if ( ! is_string( $value ) || ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $value ) ) {
			return null;
		}
		$date = DateTimeImmutable::createFromFormat( '!Y-m-d', $value, $this->tz );
		return $date ? $date : null;
	}
}
