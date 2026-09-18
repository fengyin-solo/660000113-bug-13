const express = require('express');
const router = express.Router();
const { Board } = require('../storage');
const { getTemplates, getTemplateById } = require('../templates');

router.get('/', (req, res) => {
  try {
    const templates = getTemplates();
    const simplified = templates.map((t) => ({
      _id: t._id,
      name: t.name,
      description: t.description,
      category: t.category,
      thumbnail: t.thumbnail,
      icon: t.icon,
      width: t.width,
      height: t.height,
      backgroundColor: t.backgroundColor,
    }));
    res.json(simplified);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const template = getTemplateById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(template);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/create', async (req, res) => {
  try {
    const { name, ownerId, idempotencyKey } = req.body;
    const idemKey = req.get('Idempotency-Key') || idempotencyKey || null;
    const template = getTemplateById(req.params.id);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (!ownerId) {
      return res.status(400).json({ error: 'ownerId is required' });
    }

    // 幂等去重：客户端兜底重试会复用同一键，直接返回首次创建的结果
    if (idemKey) {
      const existing = await Board.findByIdempotencyKey(idemKey);
      if (existing) {
        console.log(`[Template] Idempotent replay for key ${idemKey}, returning board ${existing._id}`);
        return res.status(200).json(existing);
      }
    }

    const boardData = {
      name: name || template.name,
      ownerId,
      width: template.width,
      height: template.height,
      backgroundColor: template.backgroundColor,
      layers: template.layers.map((layer) => ({
        name: layer.name,
        visible: layer.visible,
        locked: layer.locked,
        order: layer.order,
        elements: layer.elements,
      })),
    };

    if (idemKey) {
      boardData.idempotencyKey = idemKey;
    }

    const board = new Board(boardData);
    const savedBoard = await board.save();
    console.log(`[Template] Created board from template: ${savedBoard._id}, name: ${savedBoard.name}, layers: ${savedBoard.layers.length}`);
    res.status(201).json(savedBoard);
  } catch (err) {
    console.error('[Template] Error creating board from template:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
