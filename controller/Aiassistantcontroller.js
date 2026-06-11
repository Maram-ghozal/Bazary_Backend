require('dotenv').config();
const asyncWrapper = require('../middleware/asyncWrapper');
const AppError = require('../utils/appError');
const httpStatus = require('../utils/httpStatusText');
const Product = require('../models/productModel');
const BazaarBrand = require('../models/bazaarBrandModel');

//post /api/assistant/:bazaarId/chat
const chat = asyncWrapper(async (req, res, next) => {
    const { bazaarId } = req.params;
    const { message, history = [] } = req.body;

    if (!message || !message.trim()) {
        return next(AppError.createError('message is required', 400, httpStatus.FAIL));
    }

    const bazaarBrands = await BazaarBrand.find({ bazaarId }).select('brandId');
    const brandIds = bazaarBrands.map(bb => bb.brandId);

    if (brandIds.length === 0) {
        return res.json({
            status: httpStatus.SUCCESS,
            data: { message: 'No brands available in this bazaar yet.', products: [] }
        });
    }

    const products = await Product.find({
        brandId: { $in: brandIds },
        isActive: true,
        quantity: { $gt: 0 }
    }).populate('brandId', 'brandName brandCategory').lean();

    const productList = products.map(p => ({
        id: p._id.toString(),
        brand: p.brandId?.brandName || 'Unknown',
        category: p.brandId?.brandCategory || '',
        name: p.name,
        description: p.description || '',
        price: p.priceAfterOffer || p.price,
        originalPrice: p.price,
    }));

    const recentHistory = history.slice(-10);
    const messages = [
        {
            role: 'system',
            content: `You are a friendly and smart shopping assistant for a live marketplace bazaar.
Your job is to help customers find products from different brands.

STRICT RULES:
- Return ONLY raw JSON — no markdown, no backticks, no explanations
- Detect the customer's language and respond in the SAME language (Arabic or English)
- Understand shopping intent, not just keywords:
  "عايزة فستان لخروجة صيفي" → fashion items
  "عندي budget 300" → filter by price ≤ 300
  "هدية لصاحبتي" → gift items (jewelry, beauty, accessories, sweets)
  "something for home" → home decor

Available products:
${JSON.stringify(productList, null, 2)}

OUTPUT FORMAT:
{
  "message": "Your conversational reply here",
  "products": [
    { "id": "product_id_here", "reason": "short reason why this fits" }
  ]
}

Rules:
- Recommend 2–4 products max
- Always mention brand name and product name in message
- Mention price
- Strictly respect budget if mentioned
- If nothing matches, say so and ask what else they need
- If customer is just greeting/chatting, return empty products array`
        },
        ...recentHistory,
        { role: 'user', content: message }
    ];

    const aiResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            temperature: 0.4,
            max_tokens: 600,
            messages
        })
    });

    const aiData = await aiResponse.json();

    if (!aiResponse.ok) {
        console.log('Groq Error:', aiData);
        return next(AppError.createError('AI service failed', 500, httpStatus.ERROR));
    }

    let parsed = { message: 'عذراً، حصل خطأ. حاول تاني! / Sorry, something went wrong.', products: [] };
    try {
        let content = aiData?.choices?.[0]?.message?.content || '';
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();
        parsed = JSON.parse(content);
    } catch (err) {
        console.log('JSON Parse Error (RAW):', aiData?.choices?.[0]?.message?.content);
    }

    const recommendedIds = (parsed.products || []).map(p => p.id);
    const enriched = products
        .filter(p => recommendedIds.includes(p._id.toString()))
        .map(p => {
            const rec = parsed.products.find(r => r.id === p._id.toString());
            return {
                _id: p._id,
                name: p.name,
                description: p.description,
                price: p.price,
                priceAfterOffer: p.priceAfterOffer,
                images: p.images,
                brandName: p.brandId?.brandName,
                brandCategory: p.brandId?.brandCategory,
                reason: rec?.reason || ''
            };
        });

    const assistantTurn = {
        role: 'assistant',
        content: aiData?.choices?.[0]?.message?.content || ''
    };

    res.json({
        status: httpStatus.SUCCESS,
        data: {
            message: parsed.message,
            products: enriched,
            assistantMessage: assistantTurn
        }
    });
});

module.exports = { chat };