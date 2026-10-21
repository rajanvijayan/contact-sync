import { useEffect, useRef, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

const niceMax = ( value ) => {
	if ( value <= 4 ) {
		return 4;
	}
	const pow = Math.pow( 10, Math.floor( Math.log10( value ) ) );
	const steps = [ 1, 2, 2.5, 5, 10 ];
	for ( const step of steps ) {
		if ( value <= step * pow ) {
			return step * pow;
		}
	}
	return 10 * pow;
};

/**
 * Single-series daily bar chart with hover tooltip and an accessible table.
 *
 * @param {Object}   props
 * @param {Object[]} props.data     Rows with `date` and the value key.
 * @param {string}   props.valueKey Value key.
 * @param {string}   props.label    Series label for tooltip/table.
 * @param {number}   props.height   Chart height.
 */
export default function BarChart( {
	data = [],
	valueKey = 'total',
	label = __( 'Leads', 'contact-sync' ),
	height = 200,
} ) {
	const wrap = useRef();
	const [ width, setWidth ] = useState( 600 );
	const [ hover, setHover ] = useState( null );

	useEffect( () => {
		if ( ! wrap.current ) {
			return undefined;
		}
		const observer = new window.ResizeObserver( ( [ entry ] ) =>
			setWidth( Math.max( 240, entry.contentRect.width ) )
		);
		observer.observe( wrap.current );
		return () => observer.disconnect();
	}, [] );

	const padding = { top: 12, right: 8, bottom: 26, left: 32 };
	const innerW = width - padding.left - padding.right;
	const innerH = height - padding.top - padding.bottom;
	const max = niceMax( Math.max( 0, ...data.map( ( d ) => d[ valueKey ] ) ) );
	const ticks = [ 0, max / 2, max ];
	const slot = data.length ? innerW / data.length : innerW;
	const barW = Math.max( 4, Math.min( 28, slot - 6 ) );
	const fmtDay = ( iso, opts ) =>
		new Date( `${ iso }T00:00:00` ).toLocaleDateString( undefined, opts );
	const labelEvery = Math.ceil(
		data.length / Math.max( 1, Math.floor( innerW / 56 ) )
	);

	return (
		<div className="cs-chart" ref={ wrap }>
			<svg
				width={ width }
				height={ height }
				role="img"
				aria-label={ label }
			>
				{ ticks.map( ( tick ) => {
					const y = padding.top + innerH - ( tick / max ) * innerH;
					return (
						<g key={ tick }>
							<line
								x1={ padding.left }
								x2={ width - padding.right }
								y1={ y }
								y2={ y }
								className="cs-chart__grid"
							/>
							<text
								x={ padding.left - 8 }
								y={ y }
								dy="0.32em"
								textAnchor="end"
								className="cs-chart__axis"
							>
								{ Number.isInteger( tick )
									? tick
									: tick.toFixed( 1 ) }
							</text>
						</g>
					);
				} ) }
				{ data.map( ( d, i ) => {
					const value = d[ valueKey ];
					const h = max ? ( value / max ) * innerH : 0;
					const x = padding.left + i * slot + ( slot - barW ) / 2;
					const y = padding.top + innerH - h;
					const r = Math.min( 4, barW / 2, h );
					return (
						<g key={ d.date }>
							{ /* Wide transparent hit target, larger than the bar. */ }
							<rect
								x={ padding.left + i * slot }
								y={ padding.top }
								width={ slot }
								height={ innerH }
								fill="transparent"
								onMouseEnter={ () => setHover( i ) }
								onMouseLeave={ () => setHover( null ) }
							/>
							{ hover === i && (
								<rect
									x={ padding.left + i * slot }
									y={ padding.top }
									width={ slot }
									height={ innerH }
									className="cs-chart__hover"
								/>
							) }
							{ h > 0 && (
								<path
									d={ `M${ x },${
										y + r
									} a${ r },${ r } 0 0 1 ${ r },${ -r } h${
										barW - 2 * r
									} a${ r },${ r } 0 0 1 ${ r },${ r } V${
										padding.top + innerH
									} H${ x } Z` }
									className="cs-chart__bar"
									pointerEvents="none"
								/>
							) }
							{ i % labelEvery === 0 && (
								<text
									x={ x + barW / 2 }
									y={ height - 6 }
									textAnchor="middle"
									className="cs-chart__axis"
								>
									{ fmtDay( d.date, {
										month: 'short',
										day: 'numeric',
									} ) }
								</text>
							) }
						</g>
					);
				} ) }
				<line
					x1={ padding.left }
					x2={ width - padding.right }
					y1={ padding.top + innerH }
					y2={ padding.top + innerH }
					className="cs-chart__baseline"
				/>
			</svg>
			{ hover !== null && data[ hover ] && (
				<div
					className="cs-chart__tooltip"
					style={ {
						left: Math.min(
							width - 150,
							Math.max(
								0,
								padding.left + hover * slot + slot / 2 - 70
							)
						),
					} }
				>
					<span className="cs-chart__tooltip-date">
						{ fmtDay( data[ hover ].date, {
							weekday: 'short',
							month: 'short',
							day: 'numeric',
						} ) }
					</span>
					<span className="cs-chart__tooltip-row">
						<span className="cs-chart__swatch" />
						{ label }
						<strong>{ data[ hover ][ valueKey ] }</strong>
					</span>
				</div>
			) }
			<table className="cs-sr-only">
				<caption>{ label }</caption>
				<tbody>
					{ data.map( ( d ) => (
						<tr key={ d.date }>
							<th scope="row">{ d.date }</th>
							<td>{ d[ valueKey ] }</td>
						</tr>
					) ) }
				</tbody>
			</table>
		</div>
	);
}

/**
 * Ranked horizontal bars (single hue, magnitude).
 *
 * @param {Object}   props
 * @param {Object[]} props.items Rows with name and total.
 */
export function RankList( { items = [] } ) {
	const max = Math.max( 1, ...items.map( ( i ) => i.total ) );
	return (
		<ol className="cs-rank">
			{ items.map( ( item ) => (
				<li key={ item.name } className="cs-rank__item">
					<div className="cs-rank__head">
						<span className="cs-rank__name">{ item.name }</span>
						<span className="cs-rank__value">{ item.total }</span>
					</div>
					<div className="cs-rank__track">
						<span
							style={ {
								width: `${ ( item.total / max ) * 100 }%`,
							} }
						/>
					</div>
				</li>
			) ) }
		</ol>
	);
}
