
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import * as Tone from 'tone';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const DataVis3D = () => {
  const [dataStructure, setDataStructure] = useState('queue');
  const [elementSize, setElementSize] = useState(1);
  const [elementSpacing, setElementSpacing] = useState(3);
  const [animationSpeed, setAnimationSpeed] = useState(1);
  const [data, setData] = useState<number[]>([1, 2, 3, 4, 5]);
  const [inputValue, setInputValue] = useState('');

  const sceneContainerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const spheresRef = useRef<THREE.Mesh[]>([]); // Renamed to elementsRef for clarity
  const controlsRef = useRef<OrbitControls | null>(null);
  const synthRef = useRef<Tone.Synth | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(isPlaying);
  const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    if (!sceneContainerRef.current) return;

    const container = sceneContainerRef.current;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0xf0f0f0);

    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    cameraRef.current = camera;
    camera.position.z = 15;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    rendererRef.current = renderer;
    renderer.setPixelRatio(window.devicePixelRatio); // Moved before setSize
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.enableDamping = true;

    synthRef.current = new Tone.Synth().toDestination();

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7.5);
    scene.add(directionalLight);

    const handleResize = () => {
      if (cameraRef.current && rendererRef.current && container) {
        const width = container.clientWidth;
        const height = container.clientHeight;
        cameraRef.current.aspect = width / height;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(width, height);
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    
    // Initial call to set size based on container, not window
    handleResize();


    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      resizeObserver.unobserve(container);
      cancelAnimationFrame(animationFrameId);
      controls.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      synthRef.current?.dispose();
      spheresRef.current.forEach(sphere => {
        sphere.geometry.dispose();
        (sphere.material as THREE.Material).dispose();
         sphere.children.forEach(child => {
          if (child instanceof THREE.Mesh || child instanceof THREE.Sprite) { // Include Sprite
            if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose();
            if ((child as THREE.Mesh).material) {
                 if (Array.isArray((child as THREE.Mesh).material)) {
                    ((child as THREE.Mesh).material as THREE.Material[]).forEach(m => m.dispose());
                 } else {
                    ((child as THREE.Mesh).material as THREE.Material).dispose();
                 }
            }
             if ((child as THREE.Sprite).material?.map) {
                ((child as THREE.Sprite).material.map as THREE.Texture).dispose();
             }
             if ((child as THREE.Sprite).material) {
                (child as THREE.Sprite).material.dispose();
             }
          }
        });
      });
      sceneRef.current?.clear();
    };
  }, []);

  const playSound = useCallback((value: number) => {
    if (!synthRef.current) return;
    try {
      const note = Tone.Frequency(value * 50 + 200, "hz").toNote();
      synthRef.current.triggerAttackRelease(note, "8n", Tone.now());
    } catch (error) {
      console.error("Error playing sound:", error);
    }
  }, []);

  const updateSpheres = useCallback((currentData: number[]) => {
    if (!sceneRef.current || !cameraRef.current) return;

    spheresRef.current.forEach(sphere => {
      sceneRef.current?.remove(sphere);
      sphere.geometry.dispose();
      (sphere.material as THREE.Material).dispose();
      sphere.children.forEach(child => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Sprite) {
          if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose();
           if ((child as THREE.Mesh).material) {
             if (Array.isArray((child as THREE.Mesh).material)) {
                ((child as THREE.Mesh).material as THREE.Material[]).forEach(m => m.dispose());
             } else {
                ((child as THREE.Mesh).material as THREE.Material).dispose();
             }
           }
           if ((child as THREE.Sprite).material?.map) {
              ((child as THREE.Sprite).material.map as THREE.Texture).dispose();
           }
           if ((child as THREE.Sprite).material) {
              (child as THREE.Sprite).material.dispose();
           }
        }
      });
    });
    spheresRef.current = [];

    if (currentData.length === 0) return;

    let positions: THREE.Vector3[] = [];
    const totalWidth = (currentData.length -1) * elementSpacing;
    const startX = -totalWidth / 2;

    switch (dataStructure) {
      case 'queue':
      case 'array':
        positions = currentData.map((_, i) => new THREE.Vector3(startX + i * elementSpacing, 0, 0));
        break;
      case 'stack':
        positions = currentData.map((_, i) => new THREE.Vector3(0, i * elementSpacing - ((currentData.length -1) * elementSpacing)/2 , 0));
        break;
      default:
        positions = currentData.map((_, i) => new THREE.Vector3(startX + i * elementSpacing, 0, 0));
        break;
    }

    // Text label utility, modified to accept rotation instruction
    const createTextSprite = (text: string, rotateOnCanvas: boolean = false) => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        const fontSize = 40; // Base font size for texture
        context.font = `${fontSize}px Arial`;
        const textWidth = context.measureText(text).width;
        
        canvas.width = textWidth + 20; // Add some padding
        canvas.height = fontSize + 10; // Add some padding
        
        // Re-apply font and styles after canvas resize
        context.font = `${fontSize}px Arial`;
        context.fillStyle = "rgba(0, 0, 0, 0.9)"; // Background for text
        context.fillRect(0,0, canvas.width, canvas.height);
        
        context.fillStyle = "white"; // Text color
        context.textAlign = "center";
        context.textBaseline = "middle";

        if (rotateOnCanvas) {
            context.save();
            context.translate(canvas.width / 2, canvas.height / 2);
            context.rotate(Math.PI); // Rotate 180 degrees
            context.fillText(text, 0, 0);
            context.restore();
        } else {
            context.fillText(text, canvas.width / 2, canvas.height / 2);
        }

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);
        
        const scaleFactor = elementSize * 0.75;
        sprite.scale.set( (canvas.width / fontSize) * scaleFactor, (canvas.height / fontSize) * scaleFactor, 1 );
        return sprite;
    };

    currentData.forEach((value, i) => {
      let geometry;
      // All structures use BoxGeometry now as per previous update
      geometry = new THREE.BoxGeometry(elementSize, elementSize, elementSize);
      
      const material = new THREE.MeshStandardMaterial({ color: 0x40E0D0, roughness: 0.5, metalness: 0.1 });
      const elementMesh = new THREE.Mesh(geometry, material);
      elementMesh.position.copy(positions[i]);
      
      const textSprite = createTextSprite(String(value), false); // Front: no rotation on canvas
      textSprite.position.set(0, 0, elementSize / 2 + 0.1); 
      elementMesh.add(textSprite);

      const textSpriteBack = createTextSprite(String(value), true); // Back: text rotated 180 on canvas
      textSpriteBack.position.set(0, 0, -(elementSize / 2 + 0.1)); 
      // No material.rotation needed here as text is pre-rotated on canvas
      elementMesh.add(textSpriteBack);

      sceneRef.current?.add(elementMesh);
      spheresRef.current.push(elementMesh);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataStructure, elementSize, elementSpacing]); 


  useEffect(() => {
    updateSpheres(data);
  }, [data, updateSpheres]);


  const handleInsert = () => {
    if (inputValue === '') return;
    const newValue = parseInt(inputValue);
    if (isNaN(newValue)) return;
    
    if (dataStructure === 'stack') {
        setData(prevData => [...prevData, newValue]); 
    } else { 
        setData(prevData => [...prevData, newValue]); 
    }
    setInputValue('');
    playSound(newValue);
  };

  const handleRemove = useCallback(() => {
    setData(prevData => {
      if (prevData.length === 0) return [];
      let removedValue: number;
      let newData: number[];

      if (dataStructure === 'stack') {
        removedValue = prevData[prevData.length - 1];
        newData = prevData.slice(0, -1);
      } else { 
        removedValue = prevData[0];
        newData = prevData.slice(1);
      }
      playSound(removedValue);
      return newData;
    });
  }, [dataStructure, playSound]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  useEffect(() => {
    if (isPlaying) {
      const animateLoop = () => {
        if (!isPlayingRef.current || data.length === 0) { // Stop if not playing or data is empty
            if(data.length === 0 && isPlayingRef.current){ // If playing but data became empty, stop
                setIsPlaying(false); // This will trigger cleanup via isPlayingRef.current check
            }
            return;
        }
        
        handleRemove(); // This updates data and will trigger its own useEffect for updateSpheres

        animationTimeoutRef.current = setTimeout(() => {
          if (isPlayingRef.current) { 
            const randomValue = Math.floor(Math.random() * 20) + 1; 
            
            // This logic directly modifies data, then plays sound.
            // setData will trigger updateSpheres via its own useEffect.
            setData(prevData => {
                 if (dataStructure === 'stack') {
                    return [...prevData, randomValue];
                } else { 
                    return [...prevData, randomValue];
                }
            });
            playSound(randomValue); // Play sound for the added value
            animateLoop(); 
          }
        }, 2000 / animationSpeed);
      };
      if (data.length > 0) { // Only start loop if there's data
        animateLoop();
      } else {
        setIsPlaying(false); // Auto-stop if trying to play with no data
      }
    } else {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
        animationTimeoutRef.current = null;
      }
    }

    return () => { 
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, [isPlaying, animationSpeed, dataStructure, handleRemove, playSound, data.length]); // Added data.length


  const startAnimation = () => {
    if (data.length > 0) { // Prevent starting animation if no data
      setIsPlaying(true);
    } else {
        // Optionally, provide feedback to the user that they need to insert data first
        console.log("Cannot start animation with empty data set.");
    }
  };
  const stopAnimation = () => setIsPlaying(false);

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="p-4 bg-primary text-primary-foreground shadow-lg">
        <h1 className="text-2xl font-semibold text-center">Data Structure Visualizer</h1>
      </header>

      <div className="flex flex-col md:flex-row flex-grow p-4 gap-4">
        <aside className="w-full md:w-72 lg:w-80 p-4 bg-muted rounded-lg shadow-lg">
          <Card>
            <CardHeader>
              <CardTitle>Controls</CardTitle>
              <CardDescription>Adjust visualization settings</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="data-structure">Data Structure</Label>
                <Select value={dataStructure} onValueChange={setDataStructure}>
                  <SelectTrigger id="data-structure">
                    <SelectValue placeholder="Select a data structure" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="queue">Queue</SelectItem>
                    <SelectItem value="stack">Stack</SelectItem>
                    <SelectItem value="array">Array</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="element-size">Element Size</Label>
                <Slider
                  id="element-size"
                  defaultValue={[elementSize]}
                  min={0.5}
                  max={3}
                  step={0.1}
                  onValueChange={(value) => setElementSize(value[0])}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="element-spacing">Element Spacing</Label>
                <Slider
                  id="element-spacing"
                  defaultValue={[elementSpacing]}
                  min={1}
                  max={10}
                  step={0.1}
                  onValueChange={(value) => setElementSpacing(value[0])}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="animation-speed">Animation Speed</Label>
                <Slider
                  id="animation-speed"
                  defaultValue={[animationSpeed]}
                  min={0.1}
                  max={5}
                  step={0.1}
                  onValueChange={(value) => setAnimationSpeed(value[0])}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="insert-value">Value</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    id="insert-value"
                    placeholder="Enter value"
                    value={inputValue}
                    onChange={handleInputChange}
                  />
                  <Button onClick={handleInsert}>Insert</Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={() => handleRemove()} disabled={data.length === 0}>Remove</Button>
                {isPlaying ? (
                  <Button onClick={stopAnimation} variant="destructive">Stop</Button>
                ) : (
                  <Button onClick={startAnimation} variant="secondary" disabled={data.length === 0}>Play</Button>
                )}
              </div>
            </CardContent>
          </Card>
        </aside>

        <main className="flex-grow bg-card rounded-lg shadow-lg overflow-hidden">
          <div id="scene-container" ref={sceneContainerRef} className="w-full h-full" />
        </main>
      </div>

      <footer className="p-3 bg-muted text-muted-foreground text-center text-sm">
        <p>© {new Date().getFullYear()} DataVis3D. Interactive Learning Tool.</p>
      </footer>
    </div>
  );
};

export default DataVis3D;
