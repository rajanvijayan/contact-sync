import { createContext, useContext } from '@wordpress/element';

export const PortalContext = createContext( { me: null, reload: () => {} } );
export const usePortal = () => useContext( PortalContext );
