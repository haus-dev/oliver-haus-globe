import * as THREE from 'three';

interface AnimationState {
  isAnimating: boolean;
  currentRotation: number;
  targetRotation: number;
  pauseStartTime: number;
  animationStartTime: number;
  lastUpdateTime: number;
}

// Universal animation controller for 3D models
export class Model3DAnimator {
  private animations: Map<string, AnimationState> = new Map();
  private readonly PAUSE_DURATION = 5000; // 5 seconds in milliseconds
  private readonly ROTATION_DURATION = 2000; // 2 seconds for 180° rotation
  private animationFrameId: number | null = null;

  // Initialize animation state for a model
  initializeModel(modelId: string, _model: THREE.Object3D): void {
    const animationState: AnimationState = {
      isAnimating: false,
      currentRotation: 0,
      targetRotation: 0,
      pauseStartTime: Date.now(),
      animationStartTime: 0,
      lastUpdateTime: Date.now()
    };
    
    this.animations.set(modelId, animationState);
  }

  // Start the animation loop
  startAnimationLoop(): void {
    if (this.animationFrameId) return; // Already running
    
    const animate = () => {
      this.updateAllModels();
      this.animationFrameId = requestAnimationFrame(animate);
    };
    
    animate();
  }

  // Stop the animation loop
  stopAnimationLoop(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  // Update all models in the animation system
  private updateAllModels(): void {
    const currentTime = Date.now();
    
    this.animations.forEach((state, modelId) => {
      this.updateModelAnimation(modelId, state, currentTime);
    });
  }

  // Update individual model animation
  private updateModelAnimation(_modelId: string, state: AnimationState, currentTime: number): void {
    if (!state.isAnimating) {
      // Check if pause duration has elapsed
      if (currentTime - state.pauseStartTime >= this.PAUSE_DURATION) {
        // Start next rotation
        state.isAnimating = true;
        state.animationStartTime = currentTime;
        state.targetRotation = state.currentRotation + Math.PI; // 180 degrees
      }
    } else {
      // Calculate animation progress
      const animationElapsed = currentTime - state.animationStartTime;
      const progress = Math.min(animationElapsed / this.ROTATION_DURATION, 1);
      
      // Smooth easing function (ease-in-out)
      const easeProgress = 0.5 - Math.cos(progress * Math.PI) / 2;
      
      // Calculate current rotation
      const startRotation = state.targetRotation - Math.PI;
      state.currentRotation = startRotation + (Math.PI * easeProgress);
      
      // Check if animation is complete
      if (progress >= 1) {
        state.isAnimating = false;
        state.currentRotation = state.targetRotation;
        state.pauseStartTime = currentTime;
      }
    }
  }

  // Get current rotation for a model
  getCurrentRotation(modelId: string): number {
    const state = this.animations.get(modelId);
    return state ? state.currentRotation : 0;
  }

  // Apply rotation to a Three.js model
  applyRotationToModel(modelId: string, model: THREE.Object3D): void {
    const rotation = this.getCurrentRotation(modelId);
    model.rotation.y = rotation;
  }

  // Remove model from animation system
  removeModel(modelId: string): void {
    this.animations.delete(modelId);
  }

  // Get animation info for debugging
  getAnimationInfo(modelId: string): AnimationState | null {
    return this.animations.get(modelId) || null;
  }
}

// Export singleton instance
export const modelAnimator = new Model3DAnimator();

export default { Model3DAnimator, modelAnimator };