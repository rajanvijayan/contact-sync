import {
	createContext,
	createPortal,
	forwardRef,
	useCallback,
	useContext,
	useEffect,
	useId,
	useRef,
	useState,
} from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import Icon from '../icons';
import { initials, statusMeta } from '../format';
import { useDebounced } from '../hooks';

const cx = ( ...classes ) => classes.filter( Boolean ).join( ' ' );
export { cx };

/* Buttons ---------------------------------------------------------------- */

export const Button = forwardRef( function Button(
	{
		variant = 'secondary',
		size = 'md',
		icon,
		iconRight,
		loading = false,
		block = false,
		className,
		children,
		type = 'button',
		disabled,
		...rest
	},
	ref
) {
	return (
		<button
			ref={ ref }
			type={ type }
			className={ cx(
				'cs-btn',
				`cs-btn--${ variant }`,
				`cs-btn--${ size }`,
				block && 'cs-btn--block',
				! children && 'cs-btn--icon-only',
				loading && 'is-loading',
				className
			) }
			disabled={ disabled || loading }
			{ ...rest }
		>
			{ loading ? (
				<Spinner size={ 16 } />
			) : (
				icon && <Icon name={ icon } size={ 16 } />
			) }
			{ children && <span>{ children }</span> }
			{ iconRight && ! loading && (
				<Icon name={ iconRight } size={ 16 } />
			) }
		</button>
	);
} );

export function IconButton( {
	icon,
	label,
	size = 'sm',
	variant = 'ghost',
	...rest
} ) {
	return (
		<Button
			variant={ variant }
			size={ size }
			icon={ icon }
			aria-label={ label }
			title={ label }
			{ ...rest }
		/>
	);
}

/* Form controls ---------------------------------------------------------- */

export function Field( {
	label,
	htmlFor,
	required,
	optional,
	help,
	error,
	children,
	className,
	action,
} ) {
	return (
		<div className={ cx( 'cs-field', error && 'has-error', className ) }>
			{ label && (
				<div className="cs-field__label-row">
					<label className="cs-field__label" htmlFor={ htmlFor }>
						{ label }
						{ required && (
							<span className="cs-field__req" aria-hidden="true">
								*
							</span>
						) }
						{ optional && (
							<span className="cs-field__optional">
								{ __( 'Optional', 'contact-sync' ) }
							</span>
						) }
					</label>
					{ action }
				</div>
			) }
			{ children }
			{ error ? (
				<p className="cs-field__error" role="alert">
					<Icon name="alert" size={ 14 } />
					{ error }
				</p>
			) : (
				help && <p className="cs-field__help">{ help }</p>
			) }
		</div>
	);
}

export const Input = forwardRef( function Input(
	{ className, icon, invalid, suffix, ...rest },
	ref
) {
	return (
		<div
			className={ cx(
				'cs-input',
				icon && 'has-icon',
				suffix && 'has-suffix',
				invalid && 'is-invalid',
				className
			) }
		>
			{ icon && (
				<Icon name={ icon } size={ 16 } className="cs-input__icon" />
			) }
			<input
				ref={ ref }
				aria-invalid={ invalid || undefined }
				{ ...rest }
			/>
			{ suffix && <span className="cs-input__suffix">{ suffix }</span> }
		</div>
	);
} );

export function PasswordInput( props ) {
	const [ visible, setVisible ] = useState( false );
	return (
		<Input
			{ ...props }
			type={ visible ? 'text' : 'password' }
			suffix={
				<button
					type="button"
					className="cs-input__toggle"
					onClick={ () => setVisible( ! visible ) }
					aria-label={
						visible
							? __( 'Hide password', 'contact-sync' )
							: __( 'Show password', 'contact-sync' )
					}
				>
					<Icon name={ visible ? 'eyeOff' : 'eye' } size={ 16 } />
				</button>
			}
		/>
	);
}

export const Textarea = forwardRef( function Textarea(
	{ className, invalid, ...rest },
	ref
) {
	return (
		<textarea
			ref={ ref }
			className={ cx(
				'cs-textarea',
				invalid && 'is-invalid',
				className
			) }
			aria-invalid={ invalid || undefined }
			{ ...rest }
		/>
	);
} );

export function Select( {
	options = [],
	placeholder,
	className,
	invalid,
	...rest
} ) {
	return (
		<div
			className={ cx( 'cs-select', invalid && 'is-invalid', className ) }
		>
			<select aria-invalid={ invalid || undefined } { ...rest }>
				{ placeholder !== undefined && (
					<option value="">{ placeholder }</option>
				) }
				{ options.map( ( option ) =>
					option.options ? (
						<optgroup key={ option.label } label={ option.label }>
							{ option.options.map( ( child ) => (
								<option
									key={ child.value }
									value={ child.value }
								>
									{ child.label }
								</option>
							) ) }
						</optgroup>
					) : (
						<option
							key={ option.value }
							value={ option.value }
							disabled={ option.disabled }
						>
							{ option.label }
						</option>
					)
				) }
			</select>
			<Icon
				name="chevronDown"
				size={ 16 }
				className="cs-select__chevron"
			/>
		</div>
	);
}

export function Checkbox( {
	label,
	description,
	checked,
	onChange,
	className,
	...rest
} ) {
	const id = useId();
	return (
		<label
			className={ cx( 'cs-check', className ) }
			htmlFor={ rest.id || id }
		>
			<input
				id={ rest.id || id }
				type="checkbox"
				checked={ !! checked }
				onChange={ ( event ) =>
					onChange?.( event.target.checked, event )
				}
				{ ...rest }
			/>
			<span className="cs-check__box" aria-hidden="true">
				<Icon name="check" size={ 12 } />
			</span>
			{ ( label || description ) && (
				<span className="cs-check__text">
					{ label && (
						<span className="cs-check__label">{ label }</span>
					) }
					{ description && (
						<span className="cs-check__desc">{ description }</span>
					) }
				</span>
			) }
		</label>
	);
}

export function Radio( { label, checked, onChange, name, value, ...rest } ) {
	const id = useId();
	return (
		<label className="cs-radio" htmlFor={ id }>
			<input
				id={ id }
				type="radio"
				name={ name }
				value={ value }
				checked={ !! checked }
				onChange={ onChange }
				{ ...rest }
			/>
			<span className="cs-radio__dot" aria-hidden="true" />
			<span className="cs-check__label">{ label }</span>
		</label>
	);
}

export function Switch( { checked, onChange, label, description, disabled } ) {
	const id = useId();
	return (
		<div className={ cx( 'cs-switch-row', disabled && 'is-disabled' ) }>
			<button
				id={ id }
				type="button"
				role="switch"
				aria-checked={ !! checked }
				className={ cx( 'cs-switch', checked && 'is-on' ) }
				onClick={ () => ! disabled && onChange( ! checked ) }
				disabled={ disabled }
			>
				<span className="cs-switch__thumb" />
			</button>
			{ ( label || description ) && (
				<label htmlFor={ id } className="cs-switch-row__text">
					{ label && (
						<span className="cs-check__label">{ label }</span>
					) }
					{ description && (
						<span className="cs-check__desc">{ description }</span>
					) }
				</label>
			) }
		</div>
	);
}

export function SearchInput( {
	value,
	onChange,
	placeholder,
	delay = 300,
	className,
} ) {
	const [ local, setLocal ] = useState( value || '' );
	const debounced = useDebounced( local, delay );
	const first = useRef( true );
	useEffect( () => {
		if ( first.current ) {
			first.current = false;
			return;
		}
		onChange( debounced );
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ debounced ] );
	return (
		<Input
			className={ cx( 'cs-search', className ) }
			icon="search"
			type="search"
			value={ local }
			placeholder={ placeholder || __( 'Search…', 'contact-sync' ) }
			onChange={ ( event ) => setLocal( event.target.value ) }
		/>
	);
}

export function Segmented( { options, value, onChange, size = 'md' } ) {
	return (
		<div
			className={ cx( 'cs-segmented', `cs-segmented--${ size }` ) }
			role="tablist"
		>
			{ options.map( ( option ) => (
				<button
					key={ option.value }
					type="button"
					role="tab"
					aria-selected={ value === option.value }
					className={ cx(
						'cs-segmented__item',
						value === option.value && 'is-active'
					) }
					onClick={ () => onChange( option.value ) }
				>
					{ option.icon && <Icon name={ option.icon } size={ 15 } /> }
					{ option.label }
					{ option.count !== undefined && (
						<span className="cs-segmented__count">
							{ option.count }
						</span>
					) }
				</button>
			) ) }
		</div>
	);
}

/* Display ---------------------------------------------------------------- */

export function Card( {
	title,
	description,
	actions,
	children,
	className,
	padded = true,
	footer,
	icon,
} ) {
	return (
		<section className={ cx( 'cs-card', className ) }>
			{ ( title || actions ) && (
				<header className="cs-card__header">
					<div className="cs-card__heading">
						{ icon && (
							<span className="cs-card__icon">
								<Icon name={ icon } size={ 18 } />
							</span>
						) }
						<div>
							{ title && (
								<h2 className="cs-card__title">{ title }</h2>
							) }
							{ description && (
								<p className="cs-card__desc">{ description }</p>
							) }
						</div>
					</div>
					{ actions && (
						<div className="cs-card__actions">{ actions }</div>
					) }
				</header>
			) }
			<div
				className={ cx(
					'cs-card__body',
					! padded && 'cs-card__body--flush'
				) }
			>
				{ children }
			</div>
			{ footer && (
				<footer className="cs-card__footer">{ footer }</footer>
			) }
		</section>
	);
}

export function Badge( {
	tone = 'neutral',
	dot = false,
	children,
	className,
	icon,
} ) {
	return (
		<span className={ cx( 'cs-badge', `cs-badge--${ tone }`, className ) }>
			{ dot && <span className="cs-badge__dot" /> }
			{ icon && <Icon name={ icon } size={ 12 } /> }
			{ children }
		</span>
	);
}

export function StatusBadge( { status } ) {
	const meta = statusMeta( status );
	return (
		<Badge
			tone={ meta.tone }
			dot
			className={ status === 'syncing' ? 'is-pulsing' : '' }
		>
			{ meta.label }
		</Badge>
	);
}

export function Spinner( { size = 20, className } ) {
	return (
		<span
			className={ cx( 'cs-spinner', className ) }
			style={ { width: size, height: size } }
			role="status"
			aria-label={ __( 'Loading', 'contact-sync' ) }
		/>
	);
}

export function Skeleton( {
	width = '100%',
	height = 14,
	radius = 6,
	className,
} ) {
	return (
		<span
			className={ cx( 'cs-skeleton', className ) }
			style={ { width, height, borderRadius: radius } }
		/>
	);
}

export function EmptyState( {
	icon = 'inbox',
	title,
	description,
	action,
	compact,
} ) {
	return (
		<div className={ cx( 'cs-empty', compact && 'cs-empty--compact' ) }>
			<span className="cs-empty__icon">
				<Icon name={ icon } size={ 22 } />
			</span>
			<h3 className="cs-empty__title">{ title }</h3>
			{ description && <p className="cs-empty__desc">{ description }</p> }
			{ action && <div className="cs-empty__action">{ action }</div> }
		</div>
	);
}

export function Alert( { tone = 'info', title, children, action, onDismiss } ) {
	const icons = {
		info: 'info',
		success: 'checkCircle',
		warning: 'alert',
		danger: 'xCircle',
	};
	return (
		<div
			className={ cx( 'cs-alert', `cs-alert--${ tone }` ) }
			role={ tone === 'danger' ? 'alert' : 'status' }
		>
			<Icon
				name={ icons[ tone ] }
				size={ 18 }
				className="cs-alert__icon"
			/>
			<div className="cs-alert__body">
				{ title && <p className="cs-alert__title">{ title }</p> }
				{ children && (
					<div className="cs-alert__text">{ children }</div>
				) }
			</div>
			{ action && <div className="cs-alert__action">{ action }</div> }
			{ onDismiss && (
				<IconButton
					icon="x"
					label={ __( 'Dismiss', 'contact-sync' ) }
					onClick={ onDismiss }
				/>
			) }
		</div>
	);
}

export function Avatar( { name, size = 32 } ) {
	let hash = 0;
	for ( let i = 0; i < ( name || '' ).length; i++ ) {
		hash = ( hash * 31 + name.charCodeAt( i ) ) % 360;
	}
	return (
		<span
			className="cs-avatar"
			style={ {
				width: size,
				height: size,
				fontSize: size * 0.4,
				'--cs-avatar-hue': hash,
			} }
			aria-hidden="true"
		>
			{ initials( name ) }
		</span>
	);
}

export function PageHeader( { title, description, actions, back } ) {
	return (
		<div className="cs-page-header">
			<div className="cs-page-header__text">
				{ back && (
					<button
						type="button"
						className="cs-page-header__back"
						onClick={ back.onClick }
					>
						<Icon name="arrowLeft" size={ 14 } />
						{ back.label }
					</button>
				) }
				<h1 className="cs-page-header__title">{ title }</h1>
				{ description && (
					<p className="cs-page-header__desc">{ description }</p>
				) }
			</div>
			{ actions && (
				<div className="cs-page-header__actions">{ actions }</div>
			) }
		</div>
	);
}

export function Stat( { label, value, hint, icon, tone = 'brand', loading } ) {
	return (
		<div className="cs-stat">
			<div className="cs-stat__top">
				<span className="cs-stat__label">{ label }</span>
				{ icon && (
					<span
						className={ cx(
							'cs-stat__icon',
							`cs-tone--${ tone }`
						) }
					>
						<Icon name={ icon } size={ 16 } />
					</span>
				) }
			</div>
			<div className="cs-stat__value">
				{ loading ? <Skeleton width={ 64 } height={ 28 } /> : value }
			</div>
			{ hint && <div className="cs-stat__hint">{ hint }</div> }
		</div>
	);
}

export function Tabs( { tabs, value, onChange } ) {
	return (
		<div className="cs-tabs" role="tablist">
			{ tabs.map( ( tab ) => (
				<button
					key={ tab.id }
					type="button"
					role="tab"
					aria-selected={ value === tab.id }
					className={ cx(
						'cs-tabs__tab',
						value === tab.id && 'is-active'
					) }
					onClick={ () => onChange( tab.id ) }
				>
					{ tab.icon && <Icon name={ tab.icon } size={ 16 } /> }
					{ tab.label }
				</button>
			) ) }
		</div>
	);
}

/* Table ------------------------------------------------------------------ */

export function Table( {
	columns,
	rows,
	loading,
	onRowClick,
	empty,
	rowKey = 'id',
	skeletonRows = 6,
	selectable,
	selected = [],
	onSelect,
} ) {
	const allSelected =
		selectable &&
		rows?.length > 0 &&
		rows.every( ( row ) => selected.includes( row[ rowKey ] ) );
	const toggleAll = () =>
		onSelect( allSelected ? [] : rows.map( ( row ) => row[ rowKey ] ) );
	const toggle = ( id ) =>
		onSelect(
			selected.includes( id )
				? selected.filter( ( s ) => s !== id )
				: [ ...selected, id ]
		);

	return (
		<div className="cs-table-wrap">
			<table className={ cx( 'cs-table', onRowClick && 'is-clickable' ) }>
				<thead>
					<tr>
						{ selectable && (
							<th className="cs-table__check">
								<Checkbox
									checked={ allSelected }
									onChange={ toggleAll }
									aria-label={ __(
										'Select all',
										'contact-sync'
									) }
								/>
							</th>
						) }
						{ columns.map( ( col ) => (
							<th
								key={ col.key }
								style={ {
									width: col.width,
									textAlign: col.align,
								} }
							>
								{ col.label }
							</th>
						) ) }
					</tr>
				</thead>
				<tbody>
					{ loading &&
						! rows?.length &&
						Array.from( { length: skeletonRows } ).map(
							( _, i ) => (
								<tr key={ `s${ i }` } className="is-skeleton">
									{ selectable && <td /> }
									{ columns.map( ( col ) => (
										<td key={ col.key }>
											<Skeleton
												width={ `${
													50 +
													( ( i * 7 +
														col.key.length * 13 ) %
														40 )
												}%` }
											/>
										</td>
									) ) }
								</tr>
							)
						) }
					{ rows?.map( ( row ) => (
						<tr
							key={ row[ rowKey ] }
							onClick={
								onRowClick ? () => onRowClick( row ) : undefined
							}
							className={
								selected.includes( row[ rowKey ] )
									? 'is-selected'
									: undefined
							}
						>
							{ selectable && (
								// eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
								<td
									className="cs-table__check"
									onClick={ ( event ) =>
										event.stopPropagation()
									}
								>
									<Checkbox
										checked={ selected.includes(
											row[ rowKey ]
										) }
										onChange={ () =>
											toggle( row[ rowKey ] )
										}
										aria-label={ __(
											'Select row',
											'contact-sync'
										) }
									/>
								</td>
							) }
							{ columns.map( ( col ) => (
								<td
									key={ col.key }
									style={ { textAlign: col.align } }
									className={ col.className }
								>
									{ col.render
										? col.render( row )
										: row[ col.key ] }
								</td>
							) ) }
						</tr>
					) ) }
				</tbody>
			</table>
			{ ! loading && rows?.length === 0 && empty }
			{ loading && rows?.length > 0 && (
				<div className="cs-table-wrap__loading">
					<Spinner size={ 18 } />
				</div>
			) }
		</div>
	);
}

export function Pagination( { page, pages, total, perPage, onChange } ) {
	if ( ! total ) {
		return null;
	}
	const from = ( page - 1 ) * perPage + 1;
	const to = Math.min( total, page * perPage );
	return (
		<div className="cs-pagination">
			<span className="cs-pagination__info">
				{ sprintf(
					/* translators: 1: first row, 2: last row, 3: total rows */
					__( 'Showing %1$d–%2$d of %3$d', 'contact-sync' ),
					from,
					to,
					total
				) }
			</span>
			<div className="cs-pagination__buttons">
				<IconButton
					icon="chevronLeft"
					variant="secondary"
					label={ __( 'Previous page', 'contact-sync' ) }
					disabled={ page <= 1 }
					onClick={ () => onChange( page - 1 ) }
				/>
				<span className="cs-pagination__page">
					{ sprintf(
						/* translators: 1: current page, 2: total pages */
						__( 'Page %1$d of %2$d', 'contact-sync' ),
						page,
						Math.max( 1, pages )
					) }
				</span>
				<IconButton
					icon="chevronRight"
					variant="secondary"
					label={ __( 'Next page', 'contact-sync' ) }
					disabled={ page >= pages }
					onClick={ () => onChange( page + 1 ) }
				/>
			</div>
		</div>
	);
}

/* Overlays --------------------------------------------------------------- */

function useLockScroll( active ) {
	useEffect( () => {
		if ( ! active ) {
			return undefined;
		}
		const previous = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = previous;
		};
	}, [ active ] );
}

function Portal( { children } ) {
	const root = document.querySelector( '.cs-root' ) || document.body;
	return createPortal( children, root );
}

export function Modal( {
	open,
	onClose,
	title,
	description,
	children,
	footer,
	size = 'md',
	icon,
	tone,
} ) {
	const ref = useRef();
	useLockScroll( open );
	useEffect( () => {
		if ( ! open ) {
			return undefined;
		}
		const onKey = ( event ) => event.key === 'Escape' && onClose?.();
		document.addEventListener( 'keydown', onKey );
		const focusable = ref.current?.querySelector(
			'input, select, textarea, button:not(.cs-modal__close)'
		);
		focusable?.focus();
		return () => document.removeEventListener( 'keydown', onKey );
	}, [ open, onClose ] );

	if ( ! open ) {
		return null;
	}
	return (
		<Portal>
			<div
				className="cs-overlay"
				onMouseDown={ ( event ) =>
					event.target === event.currentTarget && onClose?.()
				}
				role="presentation"
			>
				<div
					ref={ ref }
					className={ cx( 'cs-modal', `cs-modal--${ size }` ) }
					role="dialog"
					aria-modal="true"
					aria-label={ title }
				>
					<div className="cs-modal__header">
						{ icon && (
							<span
								className={ cx(
									'cs-modal__icon',
									tone && `cs-tone--${ tone }`
								) }
							>
								<Icon name={ icon } size={ 20 } />
							</span>
						) }
						<div className="cs-modal__heading">
							<h2 className="cs-modal__title">{ title }</h2>
							{ description && (
								<p className="cs-modal__desc">
									{ description }
								</p>
							) }
						</div>
						<IconButton
							className="cs-modal__close"
							icon="x"
							label={ __( 'Close', 'contact-sync' ) }
							onClick={ onClose }
						/>
					</div>
					{ children && (
						<div className="cs-modal__body">{ children }</div>
					) }
					{ footer && (
						<div className="cs-modal__footer">{ footer }</div>
					) }
				</div>
			</div>
		</Portal>
	);
}

export function Drawer( {
	open,
	onClose,
	title,
	subtitle,
	children,
	footer,
	width = 560,
} ) {
	useLockScroll( open );
	useEffect( () => {
		if ( ! open ) {
			return undefined;
		}
		const onKey = ( event ) => event.key === 'Escape' && onClose?.();
		document.addEventListener( 'keydown', onKey );
		return () => document.removeEventListener( 'keydown', onKey );
	}, [ open, onClose ] );

	if ( ! open ) {
		return null;
	}
	return (
		<Portal>
			<div
				className="cs-overlay cs-overlay--drawer"
				onMouseDown={ ( event ) =>
					event.target === event.currentTarget && onClose?.()
				}
				role="presentation"
			>
				<aside
					className="cs-drawer"
					style={ { width } }
					role="dialog"
					aria-modal="true"
					aria-label={ title }
				>
					<div className="cs-drawer__header">
						<div>
							<h2 className="cs-drawer__title">{ title }</h2>
							{ subtitle && (
								<div className="cs-drawer__subtitle">
									{ subtitle }
								</div>
							) }
						</div>
						<IconButton
							icon="x"
							label={ __( 'Close', 'contact-sync' ) }
							onClick={ onClose }
						/>
					</div>
					<div className="cs-drawer__body">{ children }</div>
					{ footer && (
						<div className="cs-drawer__footer">{ footer }</div>
					) }
				</aside>
			</div>
		</Portal>
	);
}

export function Menu( { trigger, items, align = 'right' } ) {
	const [ open, setOpen ] = useState( false );
	const [ position, setPosition ] = useState( null );
	const ref = useRef();
	const panelRef = useRef();
	const close = useCallback( () => setOpen( false ), [] );

	// The panel renders in a portal so scrolling table wrappers can't clip it.
	useEffect( () => {
		if ( ! open ) {
			setPosition( null );
			return undefined;
		}
		const place = () => {
			const anchor = ref.current?.getBoundingClientRect();
			const panel = panelRef.current;
			if ( ! anchor || ! panel ) {
				return;
			}
			const gap = 6;
			const width = Math.max( panel.offsetWidth, anchor.width, 200 );
			const height = panel.offsetHeight;
			const below = window.innerHeight - anchor.bottom;
			const top =
				below < height + gap && anchor.top > below
					? anchor.top - height - gap
					: anchor.bottom + gap;
			let left = align === 'left' ? anchor.left : anchor.right - width;
			left = Math.max(
				8,
				Math.min( left, window.innerWidth - width - 8 )
			);
			setPosition( {
				top,
				left,
				minWidth: Math.max( anchor.width, 200 ),
			} );
		};
		place();
		const onDown = ( event ) => {
			if (
				! ref.current?.contains( event.target ) &&
				! panelRef.current?.contains( event.target )
			) {
				close();
			}
		};
		const onKey = ( event ) => event.key === 'Escape' && close();
		document.addEventListener( 'mousedown', onDown );
		document.addEventListener( 'keydown', onKey );
		window.addEventListener( 'resize', close );
		window.addEventListener( 'scroll', place, true );
		return () => {
			document.removeEventListener( 'mousedown', onDown );
			document.removeEventListener( 'keydown', onKey );
			window.removeEventListener( 'resize', close );
			window.removeEventListener( 'scroll', place, true );
		};
	}, [ open, align, close ] );

	const host =
		ref.current?.closest( '.cs-root' ) || ref.current?.ownerDocument.body;

	return (
		<div className="cs-menu" ref={ ref }>
			{ trigger( { open, toggle: () => setOpen( ! open ) } ) }
			{ open &&
				host &&
				createPortal(
					<div
						ref={ panelRef }
						className={ cx(
							'cs-menu__panel',
							`cs-menu__panel--${ align }`
						) }
						style={
							position
								? { ...position, position: 'fixed' }
								: { position: 'fixed', visibility: 'hidden' }
						}
						role="menu"
					>
						{ items.filter( Boolean ).map( ( item, index ) =>
							item.separator ? (
								<div
									key={ `sep${ index }` }
									className="cs-menu__sep"
								/>
							) : (
								<button
									key={ item.label }
									type="button"
									role="menuitem"
									className={ cx(
										'cs-menu__item',
										item.danger && 'is-danger'
									) }
									onClick={ () => {
										setOpen( false );
										item.onClick();
									} }
									disabled={ item.disabled }
								>
									{ item.icon && (
										<Icon name={ item.icon } size={ 16 } />
									) }
									{ item.label }
								</button>
							)
						) }
					</div>,
					host
				) }
		</div>
	);
}

/* Toasts & confirm ------------------------------------------------------- */

const UIContext = createContext( {
	toast: () => {},
	confirm: () => Promise.resolve( false ),
} );

export function UIProvider( { children } ) {
	const [ toasts, setToasts ] = useState( [] );
	const [ dialog, setDialog ] = useState( null );

	const toast = useCallback(
		( message, tone = 'success', timeout = 4000 ) => {
			const id = Math.random().toString( 36 ).slice( 2 );
			setToasts( ( list ) => [ ...list, { id, message, tone } ] );
			setTimeout(
				() =>
					setToasts( ( list ) =>
						list.filter( ( t ) => t.id !== id )
					),
				timeout
			);
		},
		[]
	);

	const confirm = useCallback(
		( options ) =>
			new Promise( ( resolve ) => {
				setDialog( { ...options, resolve } );
			} ),
		[]
	);

	const closeDialog = ( result ) => {
		dialog?.resolve( result );
		setDialog( null );
	};

	const icons = {
		success: 'checkCircle',
		danger: 'xCircle',
		info: 'info',
		warning: 'alert',
	};

	return (
		<UIContext.Provider value={ { toast, confirm } }>
			{ children }
			<div className="cs-toasts" aria-live="polite">
				{ toasts.map( ( t ) => (
					<div
						key={ t.id }
						className={ cx( 'cs-toast', `cs-toast--${ t.tone }` ) }
					>
						<Icon name={ icons[ t.tone ] || 'info' } size={ 18 } />
						<span>{ t.message }</span>
					</div>
				) ) }
			</div>
			<Modal
				open={ !! dialog }
				onClose={ () => closeDialog( false ) }
				title={ dialog?.title }
				description={ dialog?.message }
				icon={ dialog?.danger ? 'alert' : 'info' }
				tone={ dialog?.danger ? 'danger' : 'brand' }
				size="sm"
				footer={
					<>
						<Button onClick={ () => closeDialog( false ) }>
							{ __( 'Cancel', 'contact-sync' ) }
						</Button>
						<Button
							variant={ dialog?.danger ? 'danger' : 'primary' }
							onClick={ () => closeDialog( true ) }
						>
							{ dialog?.confirmLabel ||
								__( 'Confirm', 'contact-sync' ) }
						</Button>
					</>
				}
			/>
		</UIContext.Provider>
	);
}

export const useUI = () => useContext( UIContext );

export function CopyButton( { value, label } ) {
	const { toast } = useUI();
	return (
		<IconButton
			icon="copy"
			label={ label || __( 'Copy', 'contact-sync' ) }
			onClick={ ( event ) => {
				event.stopPropagation();
				window.navigator.clipboard
					?.writeText( value )
					.then( () =>
						toast( __( 'Copied to clipboard', 'contact-sync' ) )
					);
			} }
		/>
	);
}

export function Progress( { value, max = 100, tone = 'brand' } ) {
	const pct = max ? Math.min( 100, Math.round( ( value / max ) * 100 ) ) : 0;
	return (
		<div
			className={ cx( 'cs-progress', `cs-progress--${ tone }` ) }
			role="progressbar"
			aria-valuenow={ pct }
			aria-valuemin={ 0 }
			aria-valuemax={ 100 }
		>
			<span style={ { width: `${ pct }%` } } />
		</div>
	);
}

export function Steps( { steps, current } ) {
	return (
		<ol className="cs-steps">
			{ steps.map( ( step, index ) => (
				<li
					key={ step }
					className={ cx(
						'cs-steps__item',
						index < current && 'is-done',
						index === current && 'is-current'
					) }
					aria-current={ index === current ? 'step' : undefined }
				>
					<span className="cs-steps__marker">
						{ index < current ? (
							<Icon name="check" size={ 14 } />
						) : (
							index + 1
						) }
					</span>
					<span className="cs-steps__label">{ step }</span>
				</li>
			) ) }
		</ol>
	);
}
