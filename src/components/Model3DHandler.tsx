import maplibregl from 'maplibre-gl';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { modelAnimator } from './Model3DAnimator';

// Custom layer interface for 3D models
interface CustomLayer extends maplibregl.CustomLayerInterface {
  map?: maplibregl.Map;
  camera?: THREE.Camera;
  scene?: THREE.Scene;
  renderer?: THREE.WebGLRenderer;
  model?: THREE.Object3D;
  modelId?: string;
}

// Coordinate fetcher for models
const getCoordinates = async (modelId: string): Promise<[number, number] | null> => {
  try {
    const response = await fetch(`/models/${modelId}.txt`);
    if (!response.ok) return null;
    
    const data = JSON.parse(await response.text());
    
    if (data.lat && data.lon) {
      return [data.lon, data.lat]; // [longitude, latitude] for MapLibre
    } else if (data.location?.geo?.lat && data.location?.geo?.lon) {
      return [data.location.geo.lon, data.location.geo.lat];
    }
    
    return null;
  } catch {
    return null;
  }
};

// Create individual custom layers for each GLB model
const createModelLayer = (modelFile: string, coordinates: [number, number], isMobile: boolean = false): CustomLayer => {
  const modelName = modelFile.replace('.glb', '');
  
  return {
    id: `3d-model-${modelName}`,
    type: 'custom' as const,
    renderingMode: '3d' as const,
    
    onAdd: function(map: maplibregl.Map, gl: WebGLRenderingContext) {
      this.map = map;
      this.modelId = modelName;
      this.camera = new THREE.Camera();
      this.scene = new THREE.Scene();
      
      // Enhanced lighting for mobile
      if (isMobile) {
        // Brighter ambient light for mobile
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);
        
        // Stronger directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
        directionalLight.position.set(0, -70, 100).normalize();
        this.scene.add(directionalLight);
        
        // Add another light from different angle
        const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight2.position.set(50, 50, 50).normalize();
        this.scene.add(directionalLight2);
      } else {
        // Standard lighting for desktop
        const directionalLight = new THREE.DirectionalLight(0xffffff);
        directionalLight.position.set(0, -70, 100).normalize();
        this.scene.add(directionalLight);
      }
      
      // Renderer setup
      this.renderer = new THREE.WebGLRenderer({
        canvas: map.getCanvas(),
        context: gl,
        antialias: true
      });
      this.renderer.autoClear = false;
      
      // Load single GLB model for this layer
      const loader = new GLTFLoader();
      loader.load(`/models/${modelFile}`, (gltf) => {
        this.model = gltf.scene;
        this.scene?.add(this.model);
        
        // Initialize animation for this model
        modelAnimator.initializeModel(modelName, this.model);
      }, undefined, (error) => {
        console.error(`Failed to load ${modelFile}:`, error);
      });
    },
    
    render: function(_gl: WebGLRenderingContext, args: any) {
      if (!this.camera || !this.renderer || !this.scene || !this.map) return;
      
      // Apply animation rotation to model
      if (this.model && this.modelId) {
        modelAnimator.applyRotationToModel(this.modelId, this.model);
      }
      
      const [lng, lat] = coordinates;
      const modelAltitude = 40;
      const scaling = 10.0;
      
      // Single model positioning using official MapLibre method
      const modelMatrix = this.map.transform.getMatrixForModel([lng, lat], modelAltitude);
      const m = new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix);
      const l = new THREE.Matrix4().fromArray(modelMatrix).scale(
        new THREE.Vector3(scaling, scaling, scaling)
      );
      
      this.camera.projectionMatrix = m.multiply(l);
      this.renderer.resetState();
      this.renderer.render(this.scene, this.camera);
      this.map.triggerRepaint();
    }
  };
};

// Main function to initialize all model layers
export const initializeModelLayers = async (map: maplibregl.Map, isMobile: boolean = false): Promise<Array<{name: string, coordinates: [number, number]}>> => {
  const locations: Array<{name: string, coordinates: [number, number]}> = [];
  try {
    // Read GLB files from models.json
    const response = await fetch('/api/models.json');
    const glbFiles = await response.json();
    
    // Start the universal animation loop
    modelAnimator.startAnimationLoop();
    
    for (const glbFile of glbFiles) {
      const modelName = glbFile.replace('.glb', '');
      const coordinates = await getCoordinates(modelName);
      
      if (coordinates) {
        const modelLayer = createModelLayer(glbFile, coordinates, isMobile);
        map.addLayer(modelLayer);
        locations.push({ name: modelName, coordinates });
      }
    }
    
    return locations;
  } catch (error) {
    // Error loading models
    return locations;
  }
};

export default { initializeModelLayers };