
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
  const [sphereSize, setSphereSize] = useState(1);
  const [sphereSpacing, setSphereSpacing] = useState(3);
  const [animationSpeed, setAnimationSpeed] = useState(1);
  const [data, setData] = useState<number[]>([1, 2, 3, 4, 5]);
  const [inputValue, setInputValue] = useState('');

  const sceneContainerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const spheresRef = useRef<THREE.Mesh[]>([]);
  const controlsRef = useRef<OrbitControls | null>(null);
  const synthRef = useRef<Tone.Synth | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(isPlaying); // Ref for animation loop closure
  const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    if (!sceneContainerRef.current) return;

    const container = sceneContainerRef.current;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0xf0f0f0); // Lighter background for better visibility

    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    cameraRef.current = camera;
    camera.position.z = 15;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    rendererRef.current = renderer;
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
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
        cameraRef.current.aspect = container.clientWidth / container.clientHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(container.clientWidth, container.clientHeight);
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    handleResize(); // Initial call

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
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            (child.material as THREE.Material).dispose();
          }
        });
      });
      sceneRef.current?.clear();
    };
  }, []);

  const playSound = useCallback((value: number) => {
    if (!synthRef.current) return;
    try {
      const note = Tone.Frequency(value * 50 + 200, "hz").toNote(); // Adjusted frequency mapping
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
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      });
    });
    spheresRef.current = [];

    if (currentData.length === 0) return;

    let positions: THREE.Vector3[] = [];
    const totalWidth = (currentData.length -1) * sphereSpacing;
    const startX = -totalWidth / 2;

    switch (dataStructure) {
      case 'queue':
      case 'array':
        positions = currentData.map((_, i) => new THREE.Vector3(startX + i * sphereSpacing, 0, 0));
        break;
      case 'stack':
        positions = currentData.map((_, i) => new THREE.Vector3(0, i * sphereSpacing - ((currentData.length -1) * sphereSpacing)/2 , 0));
        break;
      default:
        positions = currentData.map((_, i) => new THREE.Vector3(startX + i * sphereSpacing, 0, 0));
        break;
    }

    currentData.forEach((value, i) => {
      let geometry;
      if (dataStructure === 'queue' || dataStructure === 'array') {
        geometry = new THREE.BoxGeometry(sphereSize, sphereSize, sphereSize);
      } else { // Stack
        geometry = new THREE.BoxGeometry(sphereSize, sphereSize, sphereSize); // Using cubes for stack too for consistency
      }
      const material = new THREE.MeshStandardMaterial({ color: 0x40E0D0, roughness: 0.5, metalness: 0.1 });
      const elementMesh = new THREE.Mesh(geometry, material);
      elementMesh.position.copy(positions[i]);

      // Text label utility
      const createTextSprite = (text: string) => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        const fontSize = 40;
        context.font = `${fontSize}px Arial`;
        const textWidth = context.measureText(text).width;
        
        canvas.width = textWidth + 20; // Add some padding
        canvas.height = fontSize + 10; // Add some padding
        
        // Re-apply font after canvas resize
        context.font = `${fontSize}px Arial`;
        context.fillStyle = "rgba(0, 0, 0, 0.9)"; // Slightly transparent background for text
        context.fillRect(0,0, canvas.width, canvas.height);
        context.fillStyle = "white";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(text, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);
        // Scale sprite appropriately. Factor depends on sphereSize and desired text visibility.
        const scaleFactor = sphereSize * 0.75;
        sprite.scale.set(canvas.width/fontSize * scaleFactor, canvas.height/fontSize * scaleFactor, 1);
        return sprite;
      };
      
      const textSprite = createTextSprite(String(value));
      textSprite.position.set(0, 0, sphereSize / 2 + 0.1); // In front
      elementMesh.add(textSprite);

      const textSpriteBack = createTextSprite(String(value));
      textSpriteBack.position.set(0, 0, -(sphereSize / 2 + 0.1)); // Behind
      textSpriteBack.material.rotation = Math.PI; // Rotate texture on sprite for back view (alternative to rotating sprite itself)
      elementMesh.add(textSpriteBack);


      sceneRef.current?.add(elementMesh);
      spheresRef.current.push(elementMesh);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataStructure, sphereSize, sphereSpacing]); // Removed data dependency, will call with data manually


  useEffect(() => {
    updateSpheres(data);
  }, [data, updateSpheres]);


  const handleInsert = () => {
    if (inputValue === '') return;
    const newValue = parseInt(inputValue);
    if (isNaN(newValue)) return;
    
    if (dataStructure === 'stack') {
        setData(prevData => [...prevData, newValue]); // Push for stack
    } else { // Queue or Array
        setData(prevData => [...prevData, newValue]); // Enqueue or add to end for Array
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
      } else { // 'queue' or 'array' - remove from the beginning
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

  // Animation Loop Effect
  useEffect(() => {
    if (isPlaying) {
      const animateLoop = () => {
        handleRemove();

        animationTimeoutRef.current = setTimeout(() => {
          if (isPlayingRef.current) { // Check ref for current state
            const randomValue = Math.floor(Math.random() * 20) + 1; // Values 1-20
            setData(prevData => {
                 if (dataStructure === 'stack') {
                    return [...prevData, randomValue]; // Push
                } else { // Queue or Array
                    return [...prevData, randomValue]; // Enqueue or add to end
                }
            });
            // playSound is called by setData's effect via handleRemove or by direct calls that modify data.
            // We need to ensure playSound is called for additions too.
            // Let's call playSound here explicitly for the added value.
            playSound(randomValue);
            animateLoop(); 
          }
        }, 2000 / animationSpeed);
      };
      animateLoop();
    } else {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
        animationTimeoutRef.current = null;
      }
    }

    return () => { // Cleanup for when component unmounts or dependencies change
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, [isPlaying, animationSpeed, dataStructure, handleRemove, playSound]);


  const startAnimation = () => setIsPlaying(true);
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
                  defaultValue={[sphereSize]}
                  min={0.5}
                  max={3}
                  step={0.1}
                  onValueChange={(value) => setSphereSize(value[0])}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="element-spacing">Element Spacing</Label>
                <Slider
                  id="element-spacing"
                  defaultValue={[sphereSpacing]}
                  min={1}
                  max={10}
                  step={0.1}
                  onValueChange={(value) => setSphereSpacing(value[0])}
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
                  <Button onClick={startAnimation} variant="secondary">Play</Button>
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

    