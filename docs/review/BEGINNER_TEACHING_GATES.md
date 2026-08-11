# Beginner teaching acceptance gates

The guided course is reviewed from the perspective of a learner who has never used Kubernetes.

A step is acceptable only when the learner can answer, without opening the technical inspector:

1. What problem is this step solving?
2. Which one or two objects should I look at?
3. What changed from the previous step?
4. Which component made that change happen?
5. What does the highlighted line mean?

Additional rules:

- Prefer human names such as `api Pod A`; keep generated names and UIDs in technical details.
- Use sentence case for chapter, view, and zone titles.
- Show no more than one primary causal route in a normal guided step.
- A region boundary must never resemble an active route.
- A scheduling decision must visibly name the selected Node before the next step shows physical placement.
- Completion titles must wrap inside their card at every supported viewport.
- Explain component responsibility, mechanism, and non-responsibility.
- Keep Node → Pod → Container and Deployment → ReplicaSet → Pod as separate mental models.
- Responsive scene grammar owns the density and label budget; beginner simplification may remove
  more labels but must never restore a label hidden by that grammar.
- On mobile, fewer than three labels is acceptable when the focused object and every route endpoint
  remain identifiable without adding redundant context.
- Provide a visible Home action on every lesson and story page.
- Browser acceptance checks must scope an assertion to the intended label or Home action rather than
  treating a valid collection of visible elements as one strict locator.
- Do not count automated overlap checks as proof that a scene is understandable.
