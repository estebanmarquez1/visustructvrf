"use client";

import { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import * as Tone from 'tone';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
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
  const sceneRef = useRef<THREE.Scene>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const rendererRef = useRef<THREE.WebGLRenderer>(null);
  const animationFrameRef = useRef<number>(0);
  const spheresRef = useRef<THREE.Mesh[]>([]);
  const controlsRef = useRef<OrbitControls>(null);
  const synthRef = useRef<Tone.Synth>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Initialize Three.js scene, camera, and renderer
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    cameraRef.current = camera;
    camera.position.z = 15;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    rendererRef.current = renderer;
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('scene-container')?.appendChild(renderer.domElement);

    // Orbit controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;

    // Initialize synth
    synthRef.current = new Tone.Synth().toDestination();

    // Handle window resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // Initial sphere setup
    updateSpheres(data);

    // Animation loop
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameRef.current);
      controls.dispose();
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    updateSpheres(data);
    if (isPlaying) {
      startAnimation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataStructure, sphereSize, sphereSpacing, data]);

  const updateSpheres = (data: number[]) => {
    if (!sceneRef.current) return;

    // Remove old spheres
    spheresRef.current.forEach(sphere => {
      sceneRef.current?.remove(sphere);
      sphere.geometry.dispose();
      (sphere.material as THREE.Material).dispose();
    });
    spheresRef.current = [];

    // Calculate positions based on data structure
    let positions: THREE.Vector3[] = [];
    switch (dataStructure) {
      case 'queue':
        positions = data.map((_, i) => new THREE.Vector3(i * sphereSpacing, 0, 0));
        break;
      case 'stack':
        positions = data.map((_, i) => new THREE.Vector3(0, i * sphereSpacing, 0));
        break;
      case 'array':
        positions = data.map((_, i) => new THREE.Vector3(i * sphereSpacing, 0, 0));
        break;
      case 'sphere':
        const radius = 5;
        positions = data.map((_, i) => {
          const angle = (i / data.length) * 2 * Math.PI;
          return new THREE.Vector3(
            radius * Math.cos(angle),
            radius * Math.sin(angle),
            0
          );
        });
        break;
      default:
        positions = data.map((_, i) => new THREE.Vector3(i * sphereSpacing, 0, 0));
        break;
    }

    // Create and add new spheres
    data.forEach((value, i) => {
      let geometry;
      if (dataStructure === 'queue' || dataStructure === 'array') {
        geometry = new THREE.BoxGeometry(sphereSize, sphereSize, sphereSize);
      } else {
        geometry = new THREE.SphereGeometry(sphereSize, 32, 32);
      }
      const material = new THREE.MeshBasicMaterial({ color: 0x40E0D0 });
      const sphere = new THREE.Mesh(geometry, material);
      sphere.position.copy(positions[i]);

      // Create text label
      const textCanvas = document.createElement('canvas');
      const textCtx = textCanvas.getContext('2d')!;
      textCanvas.width = 256;
      textCanvas.height = 128;
      textCtx.font = "40px Arial";
      textCtx.fillStyle = "black";
      textCtx.textAlign = "center";
      textCtx.textBaseline = "middle";
      textCtx.fillText(String(value), textCanvas.width / 2, textCanvas.height / 2);

      const textTexture = new THREE.CanvasTexture(textCanvas);
      const textMaterial = new THREE.MeshBasicMaterial({ map: textTexture, transparent: true });
      const textGeometry = new THREE.PlaneGeometry(sphereSize * 2, sphereSize); // Adjust size as needed
      const textMesh = new THREE.Mesh(textGeometry, textMaterial);
      textMesh.position.set(0, 0, sphereSize + 0.1); // Position the text slightly in front of the sphere
      sphere.add(textMesh);

      // Create text label for the back
      const backTextCanvas = document.createElement('canvas');
      const backTextCtx = backTextCanvas.getContext('2d')!;
      backTextCanvas.width = 256;
      backTextCanvas.height = 128;
      backTextCtx.font = "40px Arial";
      backTextCtx.fillStyle = "black";
      backTextCtx.textAlign = "center";
      backTextCtx.textBaseline = "middle";
      backTextCtx.fillText(String(value), backTextCanvas.width / 2, backTextCanvas.height / 2);

      const backTextTexture = new THREE.CanvasTexture(backTextCanvas);
      const backTextMaterial = new THREE.MeshBasicMaterial({ map: backTextTexture, transparent: true });
      const backTextGeometry = new THREE.PlaneGeometry(sphereSize * 2, sphereSize); // Adjust size as needed
      const backTextMesh = new THREE.Mesh(backTextGeometry, backTextMaterial);
      backTextMesh.position.set(0, 0, -(sphereSize + 0.1)); // Position the text slightly behind the sphere
      backTextMesh.rotation.y = Math.PI; // Rotate the text 180 degrees
      sphere.add(backTextMesh);

      sceneRef.current?.add(sphere);
      spheresRef.current.push(sphere);
    });
  };

  const handleInsert = () => {
    if (inputValue === '') return;
    const newValue = parseInt(inputValue);
    if (isNaN(newValue)) return;
    setData(prevData => [...prevData, newValue]);
    setInputValue('');
    playSound(newValue);
  };

  const handleRemove = () => {
    if (data.length === 0) return;
    const removedValue = data[0];
    let newData:number[] = [];

    if (dataStructure === 'queue') {
      newData = data.slice(1);
    } else if (dataStructure === 'stack') {
      newData = data.slice(0, -1);
    } else if (dataStructure === 'array' || dataStructure === 'sphere') {
      newData = data.slice(1);
    }
    setData(newData);
    playSound(removedValue);
  };

  const playSound = (value: number) => {
    if (!synthRef.current) return;
    const note = Tone.Frequency(value * 100, "hz").toNote();
    synthRef.current.triggerAttackRelease(note, "8n");
  };

  const startAnimation = () => {
    setIsPlaying(true);
    animateData();
  };

  const stopAnimation = () => {
    setIsPlaying(false);
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = null;
    }
  };

  const animateData = () => {
    if (!isPlaying) return;

    handleRemove();

    animationTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        const randomValue = Math.floor(Math.random() * 10) + 1;
        setData(prevData => [...prevData, randomValue]);
        playSound(randomValue);
        animateData(); // Continue the animation
      }
    }, 2000 / animationSpeed);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  return (
    <div className="flex flex-col h-screen">
      <header className="p-4 bg-secondary shadow-md">
        <h1 className="text-2xl font-semibold text-primary text-center">Data Structure Visualizer 3D</h1>
      </header>

      <div className="flex flex-grow p-4">
        {/* Left Panel - Controls */}
        <aside className="w-64 p-4 bg-muted rounded-md shadow-md mr-4">
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
                    <SelectItem value="sphere">Sphere</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sphere-size">Sphere Size</Label>
                <Slider
                  id="sphere-size"
                  defaultValue={[sphereSize]}
                  max={5}
                  step={0.1}
                  onValueChange={(value) => setSphereSize(value[0])}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sphere-spacing">Sphere Spacing</Label>
                <Slider
                  id="sphere-spacing"
                  defaultValue={[sphereSpacing]}
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
                  max={5}
                  step={0.1}
                  onValueChange={(value) => setAnimationSpeed(value[0])}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="insert-value">Insert Value</Label>
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
                <Button onClick={handleRemove}>Remove</Button>
                {isPlaying ? (
                  <Button onClick={stopAnimation}>Stop</Button>
                ) : (
                  <Button onClick={startAnimation}>Play</Button>
                )}
              </div>
            </CardContent>
          </Card>
        </aside>

        {/* Right Panel - 3D Scene */}
        <main className="flex-grow bg-light-gray rounded-md shadow-md">
          <div id="scene-container" style={{ width: '100%', height: '80vh' }} />
        </main>
      </div>

      <footer className="p-4 bg-secondary text-primary text-center">
        <p>© 2024 DataVis3D</p>
      </footer>
    </div>
  );
};

export default DataVis3D;
