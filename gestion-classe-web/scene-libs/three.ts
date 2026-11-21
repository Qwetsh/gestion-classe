/**
 * Bibliothèque « three » des scènes du tableau : three.js et les modules utiles en classe,
 * rassemblés en un seul script qui définit `window.THREE` (voir scripts/build-scene-libs.mjs).
 *
 * Une scène la demande par `<script data-gc-lib="three"></script>` : le tableau injecte ce script
 * à cet endroit, sans accès au réseau.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

export default { ...THREE, OrbitControls, GLTFLoader, MeshoptDecoder, RoomEnvironment, CSS2DRenderer, CSS2DObject, SkeletonUtils };
