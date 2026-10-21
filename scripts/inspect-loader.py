"""Run with Blender --background --disable-autoexec FILE --python this_script."""
import bpy
import json

scene = bpy.context.scene
print("LOADER_SCENE", json.dumps({
    "frames": [scene.frame_start, scene.frame_end],
    "fps": scene.render.fps,
    "engine": scene.render.engine,
    "camera": scene.camera.name if scene.camera else None,
    "objects": [{"name": o.name, "type": o.type,
                 "location": list(o.location), "dimensions": list(o.dimensions),
                 "materials": [m.name for m in o.data.materials] if hasattr(o.data, "materials") else [],
                 "animated": bool(o.animation_data)} for o in scene.objects],
    "actions": [a.name for a in bpy.data.actions],
}))
