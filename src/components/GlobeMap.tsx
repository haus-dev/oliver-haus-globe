import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { initializeModelLayers } from './Model3DHandler';

const GlobeMap = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [, setModelLocations] = useState<Array<{name: string, coordinates: [number, number]}>>([]);
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
    console.log('Is mobile device:', isMobileDevice);

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      maxPitch: isMobileDevice ? 45 : 60,
      touchZoomRotate: true,
      touchPitch: true,
      doubleClickZoom: !isMobileDevice, // Disable double-click zoom on mobile
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
      
      // Check WebGL support
      const canvas = map.current.getCanvas();
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      console.log('WebGL support:', !!gl);
      if (gl && 'getParameter' in gl) {
        console.log('Max texture size:', (gl as WebGLRenderingContext).getParameter((gl as WebGLRenderingContext).MAX_TEXTURE_SIZE));
      }

      // Set globe projection
      map.current.setProjection({
        type: 'globe'
      });



      // Add vector tiles for buildings and cities (desktop only)
      if (!isMobileDevice) {
        map.current.addSource('openmaptiles', {
          type: 'vector',
          tiles: ['https://demotiles.maplibre.org/tiles/{z}/{x}/{y}.pbf'],
          minzoom: 0,
          maxzoom: 14
        });
      }
      
      // Debug: Check if source loads
      map.current.on('sourcedata', (e) => {
        if (e.sourceId === 'openmaptiles' && e.isSourceLoaded) {
          console.log('OpenMapTiles source loaded');
        }
      });

      // Add vector-based layers (desktop only)
      if (!isMobileDevice) {
        // Add rivers
        map.current.addLayer({
        id: 'rivers',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'waterway',
        paint: {
          'line-color': '#4da6ff',
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            8, 0.5,
            12, 1,
            16, 2
          ]
        }
      });

      // Add roads
      map.current.addLayer({
        id: 'roads',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        minzoom: 5,
        paint: {
          'line-color': '#ffcc99',
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            5, 0.3,
            8, 0.5,
            12, 1,
            16, 2
          ]
        }
      });

      // Add 3D buildings
      map.current.addLayer({
          id: '3d-buildings',
          source: 'openmaptiles',
          'source-layer': 'building',
          type: 'fill-extrusion',
          minzoom: 2,
          paint: {
            'fill-extrusion-color': [
              'interpolate',
              ['linear'],
              ['get', 'render_height'],
              0, COLORS.BUILDING_LOW,
              200, COLORS.BUILDING_HIGH
            ],
            'fill-extrusion-height': ['get', 'render_height'],
            'fill-extrusion-base': [
              'interpolate',
              ['linear'],
              ['get', 'render_min_height'],
              0, 0,
              50, 2,
              200, 5
            ],
            'fill-extrusion-opacity': 0.8
          }
        });

      // Add capital cities labels
      map.current.addLayer({
        id: 'capital-cities',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'place',
        filter: ['==', 'class', 'city'],
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Bold'],
          'text-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            4, 12,
            8, 16,
            12, 20
          ],
          'text-transform': 'uppercase',
          'text-anchor': 'center',
          'text-offset': [0, 1],
          'text-allow-overlap': false,
          'text-ignore-placement': false
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#000000',
          'text-halo-width': 2,
          'text-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            3, 0,
            4, 1,
            16, 1
          ]
        }
      });
      
      } // End of desktop-only layers
      
      // Debug: Log all layers
      if (isMobileDevice) {
        console.log('Mobile layers:', map.current.getStyle().layers.map(l => l.id));
        
        // Try forcing a style update
        setTimeout(() => {
          if (map.current) {
            map.current.triggerRepaint();
            console.log('Forced repaint on mobile');
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
          e.preventDefault(); // Prevent default zoom behavior
          if (!map.current || locations.length === 0) return;

          // Navigate to next model in sequence
          const nextIndex = (tourIndex.current + 1) % locations.length;
          const targetModel = locations[nextIndex];
          
          console.log(`🎯 Double-click navigation to: ${targetModel.name}`);
          
          // Calculate camera position
          const [lng, lat] = targetModel.coordinates;
          
          let cameraLng, cameraLat;
          if (isMobileDevice) {
            // On mobile, offset 35m north of the model
            const offsetMeters = 35;
            const metersToLatitude = offsetMeters / 111320;
            cameraLng = lng;
            cameraLat = lat + metersToLatitude;
          } else {
            // On desktop, offset north of the GLB model
            const offsetMeters = 70;
            const metersToLatitude = offsetMeters / 111320;
            cameraLng = lng;
            cameraLat = lat + metersToLatitude;
          }
          
          console.log(`📍 Model at: [${lng}, ${lat}]`);
          console.log(`📷 Camera at: [${cameraLng}, ${cameraLat}] ${isMobileDevice ? '(35m north)' : '(70m north)'}`);
          
          // Use jumpTo (flyTo doesn't work with our globe setup)
          map.current.jumpTo({
            center: [cameraLng, cameraLat],
            zoom: isMobileDevice ? 19 : 19,
            pitch: 60, // Same pitch for both mobile and desktop
            bearing: 0
          });
          
          
          tourIndex.current = nextIndex;
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