import React, { useState, useRef, useEffect } from 'react';
import { useEditorStore } from '../store/editorStore';
import { Settings, Sun, Cloud } from 'lucide-react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from './ui/Accordion';
import { HexColorPicker } from 'react-colorful';
import { SceneAIEditor } from './SceneAIEditor';

export const SceneOptions: React.FC = () => {
  const { sceneOptions, sceneObjects, updateSceneOptions, activeSceneId } = useEditorStore();
  const [showBackgroundColorPicker, setShowBackgroundColorPicker] = useState(false);
  const [showFogColorPicker, setShowFogColorPicker] = useState(false);
  const bgColorRef = useRef<HTMLDivElement>(null);
  const fogColorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showBackgroundColorPicker && !showFogColorPicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (showBackgroundColorPicker && bgColorRef.current && !bgColorRef.current.contains(e.target as Node)) {
        setShowBackgroundColorPicker(false);
      }
      if (showFogColorPicker && fogColorRef.current && !fogColorRef.current.contains(e.target as Node)) {
        setShowFogColorPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showBackgroundColorPicker, showFogColorPicker]);

  return (
    <div className="w-full bg-gray-800 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Settings className="w-5 h-5 text-white" />
        <h2 className="text-white text-lg font-bold">Scene Options</h2>
      </div>

      <Accordion type="single" collapsible className="space-y-2">
        <AccordionItem value="general">
          <AccordionTrigger className="text-white">General</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4">
              <div>
                <label className="text-white text-sm block mb-1">Scene Name</label>
                <input
                  type="text"
                  aria-label="Scene Name"
                  value={sceneOptions.name}
                  onChange={(e) => updateSceneOptions({ name: e.target.value })}
                  className="w-full bg-gray-700 text-white p-2 rounded border border-gray-600 focus:border-blue-500 outline-none"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-white">
                <input aria-label="Enable jQuery" type="checkbox" checked={sceneOptions.enableJQuery ?? false}
                  onChange={event => updateSceneOptions({ enableJQuery: event.target.checked })} />
                Enable jQuery for scripts
              </label>
              <div>
                <label htmlFor="active-camera" className="text-white text-sm block mb-1">Play Camera</label>
                <select
                  id="active-camera"
                  value={sceneOptions.activeCameraId ?? ''}
                  onChange={event => updateSceneOptions({ activeCameraId: event.target.value || undefined })}
                  className="w-full bg-gray-700 text-white p-2 rounded border border-gray-600"
                >
                  <option value="">Default camera</option>
                  {sceneOptions.activeCameraId && !sceneObjects.some(object => object.id === sceneOptions.activeCameraId && object.type === 'camera') && (
                    <option value={sceneOptions.activeCameraId}>Missing camera</option>
                  )}
                  {sceneObjects.filter(object => object.type === 'camera').map(object => (
                    <option key={object.id} value={object.id}>{object.name}</option>
                  ))}
                </select>
                <p className="text-gray-400 text-xs mt-1">Uses the camera's starting transform in Play and exports. Timeline position and rotation channels also move the view.</p>
              </div>

              <div>
                <label className="text-white text-sm block mb-1">Background Color</label>
                <div className="relative" ref={bgColorRef}>
                  <button
                    className="w-full h-8 rounded border border-gray-600"
                    style={{ backgroundColor: sceneOptions.backgroundColor }}
                    onClick={() => setShowBackgroundColorPicker(!showBackgroundColorPicker)}
                  />
                  {showBackgroundColorPicker && (
                    <div className="absolute z-20 mt-1">
                      <HexColorPicker
                        color={sceneOptions.backgroundColor}
                        onChange={(color) => updateSceneOptions({ backgroundColor: color })}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="lighting">
          <AccordionTrigger className="text-white">
            <div className="flex items-center gap-2">
              <Sun className="w-4 h-4" />
              Lighting
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4">
              <div>
                <label className="text-white text-sm block mb-1">Ambient Light Intensity</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={sceneOptions.ambientLightIntensity}
                  onChange={(e) => updateSceneOptions({
                    ambientLightIntensity: parseFloat(e.target.value)
                  })}
                  className="w-full bg-gray-700"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={sceneOptions.shadowsEnabled}
                  onChange={(e) => updateSceneOptions({
                    shadowsEnabled: e.target.checked
                  })}
                  className="bg-gray-700"
                />
                <label className="text-white text-sm">Enable Shadows</label>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="fog">
          <AccordionTrigger className="text-white">
            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4" />
              Fog
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={sceneOptions.fogEnabled}
                  onChange={(e) => updateSceneOptions({
                    fogEnabled: e.target.checked
                  })}
                  className="bg-gray-700"
                />
                <label className="text-white text-sm">Enable Fog</label>
              </div>

              {sceneOptions.fogEnabled && (
                <>
                  <div>
                    <label className="text-white text-sm block mb-1">Fog Color</label>
                    <div className="relative" ref={fogColorRef}>
                      <button
                        className="w-full h-8 rounded border border-gray-600"
                        style={{ backgroundColor: sceneOptions.fogColor }}
                        onClick={() => setShowFogColorPicker(!showFogColorPicker)}
                      />
                      {showFogColorPicker && (
                        <div className="absolute z-20 mt-1">
                          <HexColorPicker
                            color={sceneOptions.fogColor}
                            onChange={(color) => updateSceneOptions({ fogColor: color })}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-white text-sm block mb-1">Fog Density</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={sceneOptions.fogDensity}
                      onChange={(e) => updateSceneOptions({
                        fogDensity: parseFloat(e.target.value)
                      })}
                      className="w-full bg-gray-700"
                    />
                  </div>
                </>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="ai">
          <AccordionTrigger className="text-white">AI Algorithms</AccordionTrigger>
          <AccordionContent>
            <SceneAIEditor key={activeSceneId} />
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="physics">
          <AccordionTrigger className="text-white">Physics Settings</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4">
              <div>
                <label className="text-white text-sm block mb-1">Gravity</label>
                <input
                  type="number"
                  step="0.1"
                  value={sceneOptions.gravity}
                  onChange={(e) => updateSceneOptions({
                    gravity: parseFloat(e.target.value)
                  })}
                  className="w-full bg-gray-700 text-white p-2 rounded border border-gray-600 focus:border-blue-500 outline-none"
                />
                <p className="text-gray-400 text-xs mt-1">Default: -9.8 (Earth gravity)</p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};
