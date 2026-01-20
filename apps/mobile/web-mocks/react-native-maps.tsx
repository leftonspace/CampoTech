/**
 * Web Mock for react-native-maps
 * ================================
 * 
 * react-native-maps doesn't support web, so we provide
 * empty components as placeholders.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Mock MapView component
const MapView = React.forwardRef<any, any>(({ children, style, ...props }, ref) => {
    return (
        <View style={[styles.container, style]} {...props}>
            <View style={styles.placeholder}>
                <Text style={styles.text}>🗺️</Text>
                <Text style={styles.label}>Map (Web Preview)</Text>
                <Text style={styles.hint}>Maps only work on mobile devices</Text>
            </View>
            {children}
        </View>
    );
});

MapView.displayName = 'MapView';

// Mock Marker component
const Marker = React.forwardRef<any, any>(({ children, ...props }, ref) => {
    return <View {...props}>{children}</View>;
});
Marker.displayName = 'Marker';

// Mock Callout component
const Callout = React.forwardRef<any, any>(({ children, ...props }, ref) => {
    return <View {...props}>{children}</View>;
});
Callout.displayName = 'Callout';

// Mock Polyline component
const Polyline = React.forwardRef<any, any>((props, ref) => null);
Polyline.displayName = 'Polyline';

// Mock Polygon component
const Polygon = React.forwardRef<any, any>((props, ref) => null);
Polygon.displayName = 'Polygon';

// Mock Circle component
const Circle = React.forwardRef<any, any>((props, ref) => null);
Circle.displayName = 'Circle';

// Mock Overlay component  
const Overlay = React.forwardRef<any, any>((props, ref) => null);
Overlay.displayName = 'Overlay';

// Mock Heatmap component
const Heatmap = React.forwardRef<any, any>((props, ref) => null);
Heatmap.displayName = 'Heatmap';

// Mock UrlTile component
const UrlTile = React.forwardRef<any, any>((props, ref) => null);
UrlTile.displayName = 'UrlTile';

// Mock WMSTile component
const WMSTile = React.forwardRef<any, any>((props, ref) => null);
WMSTile.displayName = 'WMSTile';

// Mock LocalTile component
const LocalTile = React.forwardRef<any, any>((props, ref) => null);
LocalTile.displayName = 'LocalTile';

// Constants
const PROVIDER_GOOGLE = 'google';
const PROVIDER_DEFAULT = null;

// Mock animated region
class AnimatedRegion {
    latitude: number = 0;
    longitude: number = 0;
    latitudeDelta: number = 0;
    longitudeDelta: number = 0;

    constructor(config?: any) {
        if (config) {
            this.latitude = config.latitude || 0;
            this.longitude = config.longitude || 0;
            this.latitudeDelta = config.latitudeDelta || 0;
            this.longitudeDelta = config.longitudeDelta || 0;
        }
    }

    setValue(value: any) { }
    timing(config: any) { return { start: (callback?: () => void) => callback?.() }; }
    spring(config: any) { return { start: (callback?: () => void) => callback?.() }; }
}

// Animated API
const Animated = {
    Region: AnimatedRegion,
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#e5e7eb',
        overflow: 'hidden',
    },
    placeholder: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f3f4f6',
    },
    text: {
        fontSize: 48,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
        marginTop: 12,
    },
    hint: {
        fontSize: 12,
        color: '#9ca3af',
        marginTop: 4,
    },
});

// Export all components and constants
export default MapView;
export {
    MapView,
    Marker,
    Callout,
    Polyline,
    Polygon,
    Circle,
    Overlay,
    Heatmap,
    UrlTile,
    WMSTile,
    LocalTile,
    PROVIDER_GOOGLE,
    PROVIDER_DEFAULT,
    Animated,
    AnimatedRegion,
};
