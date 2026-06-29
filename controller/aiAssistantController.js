require('dotenv').config();
const asyncWrapper = require('../middleware/asyncWrapper');
const AppError = require('../utils/appError');
const httpStatus = require('../utils/httpStatusText');
const Product = require('../models/productModel');
const BazaarBrand = require('../models/bazaarBrandModel');
const Bazaar = require('../models/bazaarModel');

const askAssistant = async (systemPrompt, history, message) => {
    const recentHistory = (history || []).slice(-10);
    const messages = [
        { role: 'system', content: systemPrompt },
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
            max_tokens: 700,
            messages
        })
    });

    const aiData = await aiResponse.json();

    if (!aiResponse.ok) {
        console.log('Groq Error:', aiData);
        const err = new Error('AI service failed');
        err.isAiError = true;
        throw err;
    }

    const rawContent = aiData?.choices?.[0]?.message?.content || '';

    let parsed = { message: 'عذراً، حصل خطأ. حاول تاني! / Sorry, something went wrong.', products: [] };
    try {
        const cleaned = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
        parsed = JSON.parse(cleaned);
    } catch (err) {
        console.log('JSON Parse Error (RAW):', rawContent);
    }

    return { parsed, rawContent };
};

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

    const systemPrompt = `You are a friendly and smart shopping assistant for a live marketplace bazaar.
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
- If customer is just greeting/chatting, return empty products array`;

    let parsed, rawContent;
    try {
        const result = await askAssistant(systemPrompt, history, message);
        parsed = result.parsed;
        rawContent = result.rawContent;
    } catch (err) {
        return next(AppError.createError('AI service failed', 500, httpStatus.ERROR));
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
        content: rawContent
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

const chatGlobal = asyncWrapper(async (req, res, next) => {
    const { message, history = [] } = req.body;

    if (!message || !message.trim()) {
        return next(AppError.createError('message is required', 400, httpStatus.FAIL));
    }

    const liveBazaars = await Bazaar.find({ status: 'LIVE' }).select('bazaarName').lean();
    const liveBazaarIds = liveBazaars.map(b => b._id);
    const bazaarNameById = new Map(liveBazaars.map(b => [b._id.toString(), b.bazaarName]));

    if (liveBazaarIds.length === 0) {
        return res.json({
            status: httpStatus.SUCCESS,
            data: { message: 'No bazaars are live right now. / لا يوجد بازارات لايف حالياً.', products: [] }
        });
    }

    const bazaarBrands = await BazaarBrand.find({ bazaarId: { $in: liveBazaarIds } })
        .select('bazaarId brandId')
        .lean();

    if (bazaarBrands.length === 0) {
        return res.json({
            status: httpStatus.SUCCESS,
            data: { message: 'No brands available in live bazaars yet. / لا يوجد براندات في البازارات اللايف حالياً.', products: [] }
        });
    }

    const brandIds = [...new Set(bazaarBrands.map(bb => bb.brandId.toString()))];

    const bazaarsByBrand = new Map();
    bazaarBrands.forEach(bb => {
        const key = bb.brandId.toString();
        const entry = { bazaarId: bb.bazaarId.toString(), bazaarName: bazaarNameById.get(bb.bazaarId.toString()) };
        if (!bazaarsByBrand.has(key)) bazaarsByBrand.set(key, []);
        bazaarsByBrand.get(key).push(entry);
    });

    const products = await Product.find({
        brandId: { $in: brandIds },
        isActive: true,
        quantity: { $gt: 0 }
    }).populate('brandId', 'brandName brandCategory').lean();

    if (products.length === 0) {
        return res.json({
            status: httpStatus.SUCCESS,
            data: { message: 'No products available in live bazaars right now. / لا يوجد منتجات متاحة في البازارات اللايف حالياً.', products: [] }
        });
    }

    const productList = [];
    products.forEach(p => {
        const brandKey = p.brandId?._id?.toString();
        const bazaars = bazaarsByBrand.get(brandKey) || [];
        bazaars.forEach(({ bazaarId, bazaarName }) => {
            productList.push({
                id: p._id.toString(),
                bazaarId,
                bazaar: bazaarName || 'Unknown bazaar',
                brand: p.brandId?.brandName || 'Unknown',
                category: p.brandId?.brandCategory || '',
                name: p.name,
                description: p.description || '',
                price: p.priceAfterOffer || p.price,
                originalPrice: p.price,
                quantity: p.quantity,
            });
        });
    });

    const systemPrompt = `You are a friendly and smart shopping assistant for Bazary, a platform that hosts several live marketplace bazaars at the same time, each with its own brands and products.
Your job is to help customers find products across ALL currently live bazaars and ALL their brands.

STRICT RULES:
- Return ONLY raw JSON — no markdown, no backticks, no explanations
- Detect the customer's language and respond in the SAME language (Arabic or English)
- Understand shopping intent, not just keywords:
  "عايزة فستان لخروجة صيفي" → fashion items
  "عندي budget 300" → filter by price ≤ 300
  "هدية لصاحبتي" → gift items (jewelry, beauty, accessories, sweets)
  "something for home" → home decor
- If the customer asks about a SPECIFIC product (by name or description), and it exists, your message MUST clearly state:
  which bazaar it's in, which brand sells it, and the product's price — e.g.
  "منتج X متوفر في بازار (اسم البازار) في براند (اسم البراند) بسعر ..." / "Product X is available in (bazaar name) bazaar, under (brand name), for ..."
- If the same product/brand is available in more than one live bazaar, mention all of them
- If a product the customer asks about does NOT exist in any live bazaar, say so clearly and don't invent one

Available products across all live bazaars (each entry already tells you which bazaar and brand it belongs to):
${JSON.stringify(productList, null, 2)}

OUTPUT FORMAT:
{
  "message": "Your conversational reply here — must mention bazaar name + brand name + price when discussing a product",
  "products": [
    { "id": "product_id_here", "bazaarId": "bazaar_id_here", "reason": "short reason why this fits" }
  ]
}

Rules:
- Recommend up to 4 products max, unless the customer asked about one specific product (then just that one, possibly repeated per bazaar it's live in)
- Always mention bazaar name, brand name and product name in message
- Mention price
- Strictly respect budget if mentioned
- If nothing matches, say so and ask what else they need
- If customer is just greeting/chatting, return empty products array`;

    let parsed, rawContent;
    try {
        const result = await askAssistant(systemPrompt, history, message);
        parsed = result.parsed;
        rawContent = result.rawContent;
    } catch (err) {
        return next(AppError.createError('AI service failed', 500, httpStatus.ERROR));
    }

    const recommended = parsed.products || [];
    const enriched = recommended
        .map(rec => {
            const product = products.find(p => p._id.toString() === rec.id);
            if (!product) return null;
            const bazaarName = rec.bazaarId
                ? bazaarNameById.get(rec.bazaarId.toString())
                : (bazaarsByBrand.get(product.brandId?._id?.toString())?.[0]?.bazaarName);
            return {
                _id: product._id,
                name: product.name,
                description: product.description,
                price: product.price,
                priceAfterOffer: product.priceAfterOffer,
                images: product.images,
                brandId: product.brandId?._id || null,
                brandName: product.brandId?.brandName,
                brandCategory: product.brandId?.brandCategory,
                bazaarId: rec.bazaarId || null,
                bazaarName: bazaarName || null,
                reason: rec?.reason || ''
            };
        })
        .filter(Boolean);

    const assistantTurn = {
        role: 'assistant',
        content: rawContent
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

module.exports = { chat, chatGlobal };