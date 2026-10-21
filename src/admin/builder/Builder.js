import {
	DndContext,
	DragOverlay,
	KeyboardSensor,
	PointerSensor,
	closestCenter,
	useSensor,
	useSensors,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { downloadFile, get, put } from '../../shared/api';
import FormRenderer, {
	initialValues,
	validateClient,
} from '../../shared/FormRenderer';
import Icon from '../../shared/icons';
import {
	Alert,
	Badge,
	Button,
	IconButton,
	Segmented,
	Spinner,
	useUI,
} from '../../shared/ui';
import { go } from '../router';
import Canvas, { FieldCard } from './Canvas';
import FieldSettings from './FieldSettings';
import FormSettings from './FormSettings';
import Palette from './Palette';
import { FIELD_TYPES, createField, uniqueKey } from './fieldTypes';
import useHistory from './useHistory';

function Preview( { schema } ) {
	const [ values, setValues ] = useState( () => initialValues( schema ) );
	const [ errors, setErrors ] = useState( {} );
	const [ ok, setOk ] = useState( false );
	return (
		<div className="cs-preview">
			<div className="cs-preview__bar">
				<Icon name="eye" size={ 16 } />
				<span>
					{ __(
						'Preview: try the form, including conditional logic. Nothing is submitted.',
						'contact-sync'
					) }
				</span>
				<Button
					size="sm"
					variant="ghost"
					icon="refresh"
					onClick={ () => {
						setValues( initialValues( schema ) );
						setErrors( {} );
						setOk( false );
					} }
				>
					{ __( 'Reset', 'contact-sync' ) }
				</Button>
			</div>
			<div className="cs-preview__paper">
				<form
					noValidate
					onSubmit={ ( e ) => {
						e.preventDefault();
						const errs = validateClient( schema, values );
						setErrors( errs );
						setOk( ! Object.keys( errs ).length );
					} }
				>
					{ ok && (
						<div className="cs-mb">
							<Alert tone="success">
								{ __(
									'Validation passed. In the portal this would be submitted.',
									'contact-sync'
								) }
							</Alert>
						</div>
					) }
					<FormRenderer
						schema={ schema }
						values={ values }
						errors={ errors }
						showHidden
						idPrefix="cs-prev"
						onChange={ ( key, value ) => {
							setOk( false );
							setValues( ( v ) => ( { ...v, [ key ]: value } ) );
						} }
					/>
					<div className="cs-form-actions">
						<span />
						<Button type="submit" variant="primary" icon="send">
							{ schema.settings?.submitLabel ||
								__( 'Submit', 'contact-sync' ) }
						</Button>
					</div>
				</form>
			</div>
		</div>
	);
}

export default function Builder( { id } ) {
	const { toast, confirm } = useUI();
	const history = useHistory( null );
	const [ form, setForm ] = useState( null );
	const [ title, setTitle ] = useState( '' );
	const [ saved, setSaved ] = useState( null );
	const [ loadError, setLoadError ] = useState( null );
	const [ selectedId, setSelectedId ] = useState( null );
	const [ mode, setMode ] = useState( 'edit' );
	const [ saving, setSaving ] = useState( false );
	const [ activeDrag, setActiveDrag ] = useState( null );
	const newIds = useRef( new Set() );

	const schema = history.value;
	const fields = useMemo( () => schema?.fields || [], [ schema ] );
	const dirty =
		!! schema &&
		( JSON.stringify( schema ) !== saved || title !== form?.title );

	useEffect( () => {
		get( `/forms/${ id }` )
			.then( ( data ) => {
				setForm( data );
				setTitle( data.title );
				history.reset( data.schema );
				setSaved( JSON.stringify( data.schema ) );
			} )
			.catch( setLoadError );
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ id ] );

	useEffect( () => {
		const warn = ( e ) => {
			if ( dirty ) {
				e.preventDefault();
				e.returnValue = '';
			}
		};
		window.addEventListener( 'beforeunload', warn );
		return () => window.removeEventListener( 'beforeunload', warn );
	}, [ dirty ] );

	const save = useCallback( async () => {
		setSaving( true );
		try {
			const result = await put( `/forms/${ id }`, { title, schema } );
			setForm( result );
			setTitle( result.title );
			history.replace( result.schema );
			setSaved( JSON.stringify( result.schema ) );
			newIds.current = new Set();
			toast(
				sprintf(
					/* translators: %d: version */ __(
						'Form saved (version %d)',
						'contact-sync'
					),
					result.version
				)
			);
		} catch ( err ) {
			toast( err.message, 'danger' );
		}
		setSaving( false );
	}, [ id, title, schema, history, toast ] );

	useEffect( () => {
		const onKey = ( e ) => {
			const mod = e.metaKey || e.ctrlKey;
			if ( ! mod ) {
				return;
			}
			if ( e.key === 's' ) {
				e.preventDefault();
				if ( dirty ) {
					save();
				}
			} else if (
				e.key === 'z' &&
				! [ 'INPUT', 'TEXTAREA' ].includes( e.target?.tagName )
			) {
				e.preventDefault();
				if ( e.shiftKey ) {
					history.redo();
				} else {
					history.undo();
				}
			}
		};
		document.addEventListener( 'keydown', onKey );
		return () => document.removeEventListener( 'keydown', onKey );
	}, [ dirty, save, history ] );

	const setFields = ( updater, tag ) =>
		history.set(
			( s ) => ( {
				...s,
				fields:
					typeof updater === 'function'
						? updater( s.fields )
						: updater,
			} ),
			tag
		);

	const insert = ( type, index ) => {
		const field = createField( type, fields );
		newIds.current.add( field.id );
		setFields( ( list ) => {
			const next = [ ...list ];
			const at =
				index ??
				( selectedId
					? list.findIndex( ( f ) => f.id === selectedId ) + 1
					: list.length );
			next.splice( at, 0, field );
			return next;
		} );
		setSelectedId( field.id );
	};

	const duplicate = ( fieldId ) => {
		const index = fields.findIndex( ( f ) => f.id === fieldId );
		const source = fields[ index ];
		const copy = {
			...JSON.parse( JSON.stringify( source ) ),
			id: `f_${ Math.random().toString( 36 ).slice( 2, 10 ) }`,
			key: uniqueKey( `${ source.key }_copy`, fields ),
			label: source.label
				? sprintf(
						/* translators: %s: label */ __(
							'%s (copy)',
							'contact-sync'
						),
						source.label
				  )
				: '',
			crm: { attribute: '', type: 'string' },
		};
		setFields( ( list ) => [
			...list.slice( 0, index + 1 ),
			copy,
			...list.slice( index + 1 ),
		] );
		setSelectedId( copy.id );
	};

	const remove = ( fieldId ) => {
		const target = fields.find( ( f ) => f.id === fieldId );
		const dependants = fields.filter( ( f ) =>
			f.conditions?.rules?.some( ( r ) => r.field === target.key )
		);
		setFields( ( list ) =>
			list
				.filter( ( f ) => f.id !== fieldId )
				.map( ( f ) => {
					if (
						! f.conditions?.rules?.some(
							( r ) => r.field === target.key
						)
					) {
						return f;
					}
					const rules = f.conditions.rules.filter(
						( r ) => r.field !== target.key
					);
					return {
						...f,
						conditions: {
							...f.conditions,
							rules,
							enabled: f.conditions.enabled && rules.length > 0,
						},
					};
				} )
		);
		if ( selectedId === fieldId ) {
			setSelectedId( null );
		}
		if ( dependants.length ) {
			toast(
				__(
					'Field deleted. Conditions that used it were removed.',
					'contact-sync'
				),
				'warning'
			);
		}
	};

	const updateField = ( next, tag ) => {
		const previous = fields.find( ( f ) => f.id === next.id );
		setFields(
			( list ) =>
				list.map( ( f ) => {
					if ( f.id === next.id ) {
						return next;
					}
					// Keep condition references intact when a key is renamed.
					if (
						previous &&
						previous.key !== next.key &&
						f.conditions?.rules?.some(
							( r ) => r.field === previous.key
						)
					) {
						return {
							...f,
							conditions: {
								...f.conditions,
								rules: f.conditions.rules.map( ( r ) =>
									r.field === previous.key
										? { ...r, field: next.key }
										: r
								),
							},
						};
					}
					return f;
				} ),
			tag
		);
	};

	const sensors = useSensors(
		useSensor( PointerSensor, { activationConstraint: { distance: 5 } } ),
		useSensor( KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		} )
	);

	const onDragEnd = ( { active, over } ) => {
		setActiveDrag( null );
		if ( ! over ) {
			return;
		}
		if ( active.data.current?.from === 'palette' ) {
			const index =
				over.id === 'canvas'
					? fields.length
					: fields.findIndex( ( f ) => f.id === over.id );
			insert(
				active.data.current.type,
				index < 0 ? fields.length : index
			);
			return;
		}
		if ( active.id !== over.id && over.id !== 'canvas' ) {
			const from = fields.findIndex( ( f ) => f.id === active.id );
			const to = fields.findIndex( ( f ) => f.id === over.id );
			setFields( ( list ) => arrayMove( list, from, to ) );
		}
	};

	if ( loadError ) {
		return <Alert tone="danger">{ loadError.message }</Alert>;
	}
	if ( ! schema ) {
		return (
			<div className="cs-boot">
				<Spinner />
			</div>
		);
	}

	const selected = fields.find( ( f ) => f.id === selectedId );
	const dragField =
		activeDrag?.from === 'palette'
			? createField( activeDrag.type, [] )
			: fields.find( ( f ) => f.id === activeDrag?.id );

	return (
		<div className="cs-builder">
			<header className="cs-builder__bar">
				<IconButton
					icon="arrowLeft"
					variant="secondary"
					label={ __( 'Back to forms', 'contact-sync' ) }
					onClick={ async () => {
						if (
							! dirty ||
							( await confirm( {
								title: __(
									'Leave without saving?',
									'contact-sync'
								),
								message: __(
									'Your changes to this form will be lost.',
									'contact-sync'
								),
								confirmLabel: __( 'Leave', 'contact-sync' ),
								danger: true,
							} ) )
						) {
							go( 'forms' );
						}
					} }
				/>
				<input
					className="cs-builder__title"
					value={ title }
					onChange={ ( e ) => setTitle( e.target.value ) }
					aria-label={ __( 'Form title', 'contact-sync' ) }
				/>
				<Badge>
					{ sprintf(
						/* translators: %d: version */ __(
							'v%d',
							'contact-sync'
						),
						form.version
					) }
				</Badge>
				{ form.is_default && (
					<Badge tone="success" dot>
						{ __( 'Live in portal', 'contact-sync' ) }
					</Badge>
				) }
				<div className="cs-builder__spacer" />
				<Segmented
					size="sm"
					value={ mode }
					onChange={ setMode }
					options={ [
						{
							value: 'edit',
							label: __( 'Build', 'contact-sync' ),
							icon: 'edit',
						},
						{
							value: 'preview',
							label: __( 'Preview', 'contact-sync' ),
							icon: 'eye',
						},
					] }
				/>
				<div className="cs-builder__history">
					<IconButton
						icon="undo"
						label={ __( 'Undo (Ctrl+Z)', 'contact-sync' ) }
						disabled={ ! history.canUndo }
						onClick={ history.undo }
					/>
					<IconButton
						icon="redo"
						label={ __( 'Redo (Ctrl+Shift+Z)', 'contact-sync' ) }
						disabled={ ! history.canRedo }
						onClick={ history.redo }
					/>
				</div>
				<Button
					size="sm"
					icon="download"
					onClick={ async () => {
						const file = await get( `/forms/${ id }/sample-csv` );
						downloadFile( file.filename, file.content );
					} }
					disabled={ dirty }
					title={ dirty ? __( 'Save first', 'contact-sync' ) : '' }
				>
					{ __( 'Sample CSV', 'contact-sync' ) }
				</Button>
				<Button
					size="sm"
					variant="primary"
					icon={ dirty ? 'check' : undefined }
					onClick={ save }
					loading={ saving }
					disabled={ ! dirty || ! title.trim() }
				>
					{ dirty
						? __( 'Save changes', 'contact-sync' )
						: __( 'Saved', 'contact-sync' ) }
				</Button>
			</header>

			{ mode === 'preview' ? (
				<Preview schema={ schema } />
			) : (
				<DndContext
					sensors={ sensors }
					collisionDetection={ closestCenter }
					onDragStart={ ( { active } ) =>
						setActiveDrag(
							active.data.current?.from === 'palette'
								? active.data.current
								: { id: active.id }
						)
					}
					onDragCancel={ () => setActiveDrag( null ) }
					onDragEnd={ onDragEnd }
				>
					<div className="cs-builder__body">
						<aside className="cs-builder__palette">
							<Palette onAdd={ ( type ) => insert( type ) } />
						</aside>
						{ /* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */ }
						<div
							className="cs-builder__canvas"
							onClick={ () => setSelectedId( null ) }
						>
							<div className="cs-builder__paper">
								<Canvas
									fields={ fields }
									selectedId={ selectedId }
									onSelect={ setSelectedId }
									onDuplicate={ duplicate }
									onRemove={ remove }
								/>
								{ fields.length > 0 && (
									<div className="cs-builder__submit">
										<span className="cs-btn cs-btn--primary cs-btn--md">
											{ schema.settings?.submitLabel ||
												__( 'Submit', 'contact-sync' ) }
										</span>
									</div>
								) }
							</div>
						</div>
						<aside className="cs-builder__settings">
							{ selected ? (
								<FieldSettings
									key={ selected.id }
									field={ selected }
									fields={ fields }
									isNew={ newIds.current.has( selected.id ) }
									onChange={ updateField }
								/>
							) : (
								<FormSettings
									schema={ schema }
									fields={ fields }
									onChange={ ( next, tag ) =>
										history.set( next, tag )
									}
								/>
							) }
						</aside>
					</div>
					<DragOverlay dropAnimation={ null }>
						{ dragField && (
							<div className="cs-drag-ghost">
								{ activeDrag?.from === 'palette' ? (
									<span className="cs-palette__item is-overlay">
										<span className="cs-palette__icon">
											<Icon
												name={
													FIELD_TYPES[
														dragField.type
													].icon
												}
												size={ 16 }
											/>
										</span>
										{ FIELD_TYPES[ dragField.type ].label }
									</span>
								) : (
									<FieldCard
										field={ dragField }
										fields={ fields }
										overlay
									/>
								) }
							</div>
						) }
					</DragOverlay>
				</DndContext>
			) }
		</div>
	);
}
