---
name: image-generation-visualizer
description: High-fidelity visual creation using Imagen-3. Generates presentation themes, backgrounds, structural diagrams, and custom graphics.
---

# Image Generation and Visual Design Skill

When requested to create custom illustrations, visual background themes, diagrams, logos, or high-fidelity infographics:
1. **Activate the Image Maker**: Ensure the built-in `image_generation` tool capability is checked/enabled.
2. **Visual Style Guidelines**:
   - For presentation backgrounds, use abstract, elegant, high-contrast twilight/cosmic styles or minimalist layouts with generous negative space.
   - Avoid busy or distracting elements; the visual should reinforce the slide's textual content, not compete with it.
   - For structural diagrams or infographics, use simple, high-fidelity geometry, light gradients, and professional typography styling.
3. **Formatted Generation Request**: Always add your image task(s) to the JSON output's `imageGenerations` array:
   - Provide a highly specific, descriptive, colorful prompt (e.g. 'Minimalist UI vector design icon concept, simple soft orange energy sphere on slate gray background, tech-style, high contrast, 1:1, ultra high resolution').
   - Provide a unique, self-contained safe filename (e.g. 'custom_tech_icon.jpg').
4. **Code Delivery**:
   - Refactor slides to place the generated asset inside standard elements:
     ```tsx
     <img 
       src="/generated/custom_tech_icon.jpg" 
       alt="Visual Representation" 
       referrerPolicy="no-referrer" 
       className="w-full max-w-md mx-auto rounded-3xl object-cover shadow-lg border border-stone-850/40"
     />
     ```
   - **CRITICAL**: Always ensure that you add `referrerPolicy="no-referrer"` on all rendered `<img>` elements.
