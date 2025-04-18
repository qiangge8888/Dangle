import {
  Panel,
  Group,
  vlayout,
  layoutConfig,
  Gravity,
  navbar,
  stack,
  imageDecoder,
  AssetsResource,
} from "doric";
import { dangleView, DangleWebGLRenderingContext, vsync } from "dangle";

const global = new Function("return this")();
global.window = {
  devicePixelRatio: 1,
  addEventListener: (() => {}) as any,
  navigator: {
    appVersion:
      "5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36",
  },
  requestAnimationFrame: vsync(context).requestAnimationFrame,
  cancelAnimationFrame: vsync(context).cancelAnimationFrame,
};
global.navigator = global.window.navigator;

import * as pc from "playcanvas";

@Entry
class mesh_generation extends Panel {
  onShow() {
    navbar(context).setTitle("mesh_generation");
  }
  build(rootView: Group) {
    vlayout([
      stack(
        [
          dangleView({
            onReady: async (gl: DangleWebGLRenderingContext) => {
              const width = gl.drawingBufferWidth;
              const height = gl.drawingBufferHeight;

              const canvas = {
                width: width,
                height: height,
                style: {},
                addEventListener: (() => {}) as any,
                removeEventListener: (() => {}) as any,
                clientHeight: height,
                getContext: (() => {
                  return gl;
                }) as any,
                getBoundingClientRect: (() => {
                  return {
                    width: width,
                    height: height,
                  };
                }) as any,
              } as HTMLCanvasElement;

              global.window.innerWidth = width;
              global.window.innerHeight = height;

              const assetsResource = new AssetsResource(
                "playcanvas/playcanvas-grey.png"
              );
              const imageInfo = await imageDecoder(context).getImageInfo(
                assetsResource
              );
              const imagePixels = await imageDecoder(context).decodeToPixels(
                assetsResource
              );
              const array = new Uint8Array(imagePixels);

              //#region code to impl
              // Create the app and start the update loop
              const app = new pc.Application(canvas, {});

              const graphicsDevice = new pc.GraphicsDevice(canvas, {});

              const texture = new pc.Texture(graphicsDevice, {
                width: imageInfo.width,
                height: imageInfo.height,
                format: pc.PIXELFORMAT_R8_G8_B8_A8,
              });

              var pixels = texture.lock();
              for (var i = 0; i < pixels.length; i++) {
                pixels[i] = array[i];
              }
              texture.unlock();

              let assets = {
                playcanvasGrey: {
                  resource: texture,
                },
              };

              // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
              app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
              app.setCanvasResolution(pc.RESOLUTION_AUTO);

              app.scene.ambientLight = new pc.Color(0.1, 0.1, 0.1);

              // helper function to create a light
              function createLight(color: pc.Color, scale: number) {
                // Create an Entity with a omni light component, which is casting shadows (using rendering to cubemap)
                const light = new pc.Entity();
                light.addComponent("light", {
                  type: "omni",
                  color: color,
                  radius: 10,
                  castShadows: false,
                });

                // create material of specified color
                const material = new pc.StandardMaterial();
                material.emissive = color;
                material.update();

                // add sphere at the position of light
                light.addComponent("render", {
                  type: "sphere",
                  material: material,
                });

                // Scale the sphere
                light.setLocalScale(scale, scale, scale);

                app.root.addChild(light);
                return light;
              }

              // create 4 lights that will move in the scene and deform the mesh as well
              const lights = [
                {
                  radius: 7,
                  speed: 1,
                  scale: 2.5,
                  light: createLight(new pc.Color(0.3, 0.9, 0.6), 1.0),
                },
                {
                  radius: 3,
                  speed: 1.2,
                  scale: 3.0,
                  light: createLight(new pc.Color(0.7, 0.2, 0.3), 1.3),
                },
                {
                  radius: 5,
                  speed: -0.8,
                  scale: 4.0,
                  light: createLight(new pc.Color(0.2, 0.2, 0.9), 1.5),
                },
                {
                  radius: 4,
                  speed: -0.3,
                  scale: 5.5,
                  light: createLight(new pc.Color(0.8, 0.9, 0.4), 1.7),
                },
              ];

              // Create an Entity with a camera component
              const camera = new pc.Entity();
              camera.addComponent("camera", {
                clearColor: new pc.Color(0.2, 0.2, 0.2),
              });

              // Add the new Entity to the hierarchy
              app.root.addChild(camera);

              // Position the camera
              camera.translate(0, 5, 20);
              camera.lookAt(pc.Vec3.ZERO);

              // Generate a 3D grid plane with world size of 20, and resolution of 60
              const resolution = 60;
              const extent = 20;
              const scale = extent / resolution;

              // Generate positions and uv coordinates for verticies, store them in Float32Arrays
              const positions = new Float32Array(3 * resolution * resolution);
              const uvs = new Float32Array(2 * resolution * resolution);
              let index = 0;
              for (let x = 0; x < resolution; x++) {
                for (let z = 0; z < resolution; z++) {
                  positions[3 * index] = scale * (x - resolution * 0.5);
                  positions[3 * index + 1] = 0; // no elevation, flat grid
                  positions[3 * index + 2] = scale * (z - resolution * 0.5);
                  uvs[2 * index] = x / resolution;
                  uvs[2 * index + 1] = 1 - z / resolution;
                  index++;
                }
              }

              // Generate array of indicies to form triangle list - two triangles per grid square
              const indexArray: any = [];
              for (let x = 0; x < resolution - 1; x++) {
                for (let y = 0; y < resolution - 1; y++) {
                  indexArray.push(
                    x * resolution + y + 1,
                    (x + 1) * resolution + y,
                    x * resolution + y,
                    (x + 1) * resolution + y,
                    x * resolution + y + 1,
                    (x + 1) * resolution + y + 1
                  );
                }
              }

              // helper function to update required vertex / index streams
              function updateMesh(mesh: pc.Mesh, initAll?: boolean) {
                // Set updated positions and normal each frame
                mesh.setPositions(positions);
                // @ts-ignore engine-tsd
                mesh.setNormals(pc.calculateNormals(positions, indexArray));

                // update mesh Uvs and Indices only one time, as they do not change each frame
                if (initAll) {
                  mesh.setUvs(0, uvs);
                  mesh.setIndices(indexArray);
                }

                // Let mesh update Vertex and Index buffer as needed
                mesh.update(pc.PRIMITIVE_TRIANGLES);
              }

              // Create a mesh with dynamic vertex buffer and static index buffer
              const mesh = new pc.Mesh(app.graphicsDevice);
              mesh.clear(true, false);
              updateMesh(mesh, true);

              // create material
              const material = new pc.StandardMaterial();
              material.diffuseMap = assets.playcanvasGrey.resource;
              material.gloss = 50;
              material.metalness = 0.3;
              material.useMetalness = true;
              material.update();

              // Create the mesh instance
              const meshInstance = new pc.MeshInstance(mesh, material);

              // Create the entity with render component using meshInstances
              const entity = new pc.Entity();
              entity.addComponent("render", {
                meshInstances: [meshInstance],
              });
              app.root.addChild(entity);

              // Set an update function on the app's update event
              let time = 0;

              app.on("update", function (dt) {
                time += dt;

                // Move the lights along circles, also keep separate list of their position for faster update in next block of code
                const lightPositions = [];
                for (let l = 0; l < lights.length; l++) {
                  const element = lights[l];
                  const lightPos = new pc.Vec2(
                    element.radius * Math.sin(time * element.speed),
                    element.radius * Math.cos(time * element.speed)
                  );
                  //@ts-ignore
                  lightPositions.push(lightPos);
                  element.light.setLocalPosition(lightPos.x, 3, lightPos.y);
                }

                // animate .y coordinate of grid vertices by moving them up when lights are close
                let index = 0;
                for (let x = 0; x < resolution; x++) {
                  for (let z = 0; z < resolution; z++) {
                    let elevation = 0;

                    // Evaluate distance of grid vertex to each light position, and increase elevation if light is within the range
                    for (let l = 0; l < lightPositions.length; l++) {
                      //@ts-ignore
                      const dx = positions[index] - lightPositions[l].x;
                      //@ts-ignore
                      const dz = positions[index + 2] - lightPositions[l].y;
                      let dist = Math.sqrt(dx * dx + dz * dz);
                      dist = pc.math.clamp(dist, 0, lights[l].scale);
                      dist = pc.math.smoothstep(0, lights[l].scale, dist);
                      elevation += 1 - dist;
                    }

                    // Store elevation in .y element
                    positions[index + 1] = elevation;
                    index += 3;
                  }
                }

                // update the mesh
                updateMesh(mesh);
                gl.endFrame();
              });

              app.start();

              //#endregion
            },
          }).apply({
            layoutConfig: layoutConfig().just(),
            width: 300,
            height: 300,
          }),
        ],
        {
          layoutConfig: layoutConfig().just(),
          width: 300,
          height: 300,
        }
      ),
    ])
      .apply({
        layoutConfig: layoutConfig().fit().configAlignment(Gravity.Center),
        space: 20,
        gravity: Gravity.Center,
      })
      .in(rootView);
  }
}
