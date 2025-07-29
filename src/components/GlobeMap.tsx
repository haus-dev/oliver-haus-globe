import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { initializeModelLayers } from './Model3DHandler';

const GlobeMap = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [modelLocations, setModelLocations] = useState<Array<{name: string, coordinates: [number, number]}>>([]);
  const tourIndex = useRef(-1);
  const [isMobile, setIsMobile] = useState(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
  
  
  const COLORS = {
    BUILDING_LOW: '#4f7a28',
    BUILDING_HIGH: '#006d8f'
  };


  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    // Check if mobile device
    const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    setIsMobile(isMobileDevice);

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      maxPitch: isMobileDevice ? 45 : 60,
      touchZoomRotate: true,
      touchPitch: true,
      doubleClickZoom: false, // Disable default double-click zoom to use custom handler
      trackResize: true,
      refreshExpiredTiles: false,
      fadeDuration: 0,
      canvasContextAttributes: { antialias: true },
      style: {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {
          'natural-earth': {
            type: 'vector',
            url: 'https://demotiles.maplibre.org/tiles/tiles.json'
          },
          'satellite': {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
            ],
            tileSize: 256,
            minzoom: 0,
            maxzoom: 19,
            attribution: '© Esri'
          },
          'openmaptiles': {
            type: 'vector',
            url: 'https://api.maptiler.com/tiles/v3/tiles.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL',
            attribution: '© MapTiler © OpenStreetMap contributors'
          }
        },
        layers: isMobileDevice ? [
          {
            id: 'background',
            type: 'background',
            paint: {
              'background-color': '#000000'
            }
          },
          {
            id: 'satellite-layer',
            type: 'raster',
            source: 'satellite',
            paint: {
              'raster-opacity': 1
            }
          }
        ] : [
          {
            id: 'background',
            type: 'background',
            paint: {
              'background-color': 'transparent'
            }
          },
          {
            id: 'countries',
            type: 'fill',
            source: 'natural-earth',
            'source-layer': 'countries',
            paint: {
              'fill-color': '#fae1f6',
              'fill-opacity': 0.7
            }
          },
          {
            id: 'country-borders',
            type: 'line',
            source: 'natural-earth',
            'source-layer': 'countries',
            paint: {
              'line-color': '#b8d4bc',
              'line-width': 1
            }
          }
        ]
      },
      center: [0, 20],
      zoom: 0
    });

    map.current.on('style.load', () => {
      if (!map.current) return;
      
      // Check WebGL support - skip warning if map is working
      try {
        const canvas = map.current.getCanvas();
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        // Don't warn if we're already rendering successfully
      } catch (e) {
        console.warn('WebGL check failed - continuing anyway');
      }

      // Set globe projection
      map.current.setProjection({
        type: 'globe'
      });

      // Add 3D buildings layer only on desktop (not mobile with satellite)
      if (!isMobileDevice) {
        // Try to add buildings layer after source loads - only once
        let buildingsLayerAdded = false;
        map.current.on('sourcedata', (e) => {
          if (e.sourceId === 'openmaptiles' && e.isSourceLoaded && !buildingsLayerAdded) {
            try {
              // Check if layer already exists
              if (!map.current?.getLayer('3d-buildings')) {
                map.current?.addLayer({
                  id: '3d-buildings',
                  source: 'openmaptiles',
                  'source-layer': 'building',
                  type: 'fill-extrusion',
                  minzoom: 15,
                  filter: ['!=', ['get', 'hide_3d'], true],
                  paint: {
                    'fill-extrusion-color': [
                      'interpolate',
                      ['linear'],
                      ['get', 'render_height'],
                      0, COLORS.BUILDING_LOW,
                      50, COLORS.BUILDING_HIGH,
                      100, '#b8d4bc'
                    ],
                    'fill-extrusion-height': [
                      'interpolate',
                      ['linear'],
                      ['zoom'],
                      15, 0,
                      16, ['get', 'render_height']
                    ],
                    'fill-extrusion-base': [
                      'interpolate',
                      ['linear'],
                      ['zoom'],
                      15, 0,
                      16, ['get', 'render_min_height']
                    ],
                    'fill-extrusion-opacity': 0.8
                  }
                });
                buildingsLayerAdded = true;
              }
            } catch (error) {
              console.log('Could not add 3D buildings - source layer may not exist');
            }
          }
        });
      }



      // Remove vector tiles for now since they're causing errors
      // Focus on GLB models only
      
      // Ensure proper rendering on mobile
      if (isMobileDevice) {
        // Force a style update for mobile devices
        setTimeout(() => {
          if (map.current) {
            map.current.triggerRepaint();
          }
        }, 1000);
      }

    });

    // Add zoom-based pitch control (desktop only)
    if (!isMobileDevice) {
      map.current.on('zoom', () => {
        if (!map.current) return;
        
        const zoom = map.current.getZoom();
        let pitch = 0;
        
        // Gradually increase pitch as user zooms in
        if (zoom > 2) {
          pitch = Math.min((zoom - 2) * 8, 60);
        }
        
        map.current.setPitch(pitch);
      });
    }


    
    map.current.on('style.load', async () => {
      if (map.current) {
        // Initialize 3D model layers after style loads
        const locations = await initializeModelLayers(map.current, isMobileDevice);
        setModelLocations(locations);
        
        // Add double-click handler AFTER models are loaded
        map.current.on('dblclick', (e) => {
          if (!map.current || locations.length === 0) return;

          if (isMobileDevice) {
            // Mobile: Navigate to next model on double-tap
            e.preventDefault(); // Prevent default zoom behavior
            
            // Navigate to next model in sequence
            const nextIndex = (tourIndex.current + 1) % locations.length;
            const targetModel = locations[nextIndex];
            
            // Calculate camera position - offset 35m north of the model
            const [lng, lat] = targetModel.coordinates;
            const offsetMeters = 35;
            const metersToLatitude = offsetMeters / 111320;
            const cameraLng = lng;
            const cameraLat = lat + metersToLatitude;
            
            // Use jumpTo for mobile navigation
            map.current.jumpTo({
              center: [cameraLng, cameraLat],
              zoom: 19,
              pitch: 60,
              bearing: 0
            });
            
            tourIndex.current = nextIndex;
          } else {
            // Desktop: Navigate to next model with different settings
            e.preventDefault(); // Prevent default zoom behavior
            
            // Navigate to next model in sequence
            const nextIndex = (tourIndex.current + 1) % locations.length;
            const targetModel = locations[nextIndex];
            
            // Calculate camera position - offset 70m north of the model for desktop
            const [lng, lat] = targetModel.coordinates;
            const offsetMeters = 70;
            const metersToLatitude = offsetMeters / 111320;
            const cameraLng = lng;
            const cameraLat = lat + metersToLatitude;
            
            // Use jumpTo for desktop navigation with different settings
            map.current.jumpTo({
              center: [cameraLng, cameraLat],
              zoom: 19,
              pitch: 60,
              bearing: 0
            });
            
            tourIndex.current = nextIndex;
          }
        });
      }
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <div 
        ref={mapContainer} 
        style={{ 
          width: '100%', 
          height: '100vh',
          touchAction: 'none'
        }} 
      />
      <div className="ui-overlay">
        <div className={`glass-container top-bar ${isMobile ? 'mobile' : ''}`}>
          <a href="mailto:oliver.haus@icloud.com" className="email-button">
            Click this to send email for more info
          </a>
        </div>
        <div className={`glass-container bottom-instruction ${isMobile ? 'mobile' : ''}`}>
          {isMobile ? 'Double tap on globe to see more' : 'Double click on globe to see more'}
        </div>
      </div>
    </div>
  );
};

export default GlobeMap;