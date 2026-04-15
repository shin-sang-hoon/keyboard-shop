import { Canvas } from '@react-three/fiber'
import { useGLTF, OrbitControls, Stage } from '@react-three/drei'
import { Suspense } from 'react'

function KeyboardModel() {
    const { scene } = useGLTF('/models/mechanical_keyboard_-_aesthetic.glb')
    return <primitive object={scene} scale={2} />
}

export default function KeyboardViewer() {
    return (
        <div style={{ width: '100vw', height: '100vh' }}>
            <Canvas camera={{ position: [0, 2, 5], fov: 50 }}>
                <Suspense fallback={null}>
                    <Stage environment="city" intensity={0.5}>
                        <KeyboardModel />
                    </Stage>
                    <OrbitControls autoRotate autoRotateSpeed={1} />
                </Suspense>
            </Canvas>
        </div>
    )
}