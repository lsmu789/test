/**
 * Cloudflare Pages Function for AI 동화 생성
 * 조선왕조실록을 기반으로 5단계 동화를 생성합니다
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    // Get authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid Authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const token = authHeader.substring(7);

    // Verify JWT with Supabase
    const supabaseUrl = env.SUPABASE_URL;
    const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase environment variables');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Call Supabase to verify JWT
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': supabaseServiceKey,
      },
    });

    if (!userResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const user = await userResponse.json();
    const userId = user.id;

    // Parse request body
    const { theme, freedom, volume, step, fairytaleId } = await request.json();

    // Validate input
    if (!theme || !['클래식', '호러', '액션', '로맨스', '사실기반'].includes(theme)) {
      return new Response(
        JSON.stringify({ error: 'Invalid theme' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (typeof freedom !== 'number' || freedom < 0 || freedom > 1) {
      return new Response(
        JSON.stringify({ error: 'Freedom must be between 0 and 1' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (typeof volume !== 'number' || volume < 0 || volume > 1) {
      return new Response(
        JSON.stringify({ error: 'Volume must be between 0 and 1' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (!step || ![1, 2, 3, 4, 5].includes(step)) {
      return new Response(
        JSON.stringify({ error: 'Step must be between 1 and 5' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Get silok data from environment
    const silokContent = env.SILOK_CONTENT;
    if (!silokContent) {
      console.error('Missing SILOK_CONTENT');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Calculate OpenAI parameters
    const temperature = freedom; // 자유도를 temperature로 매핑
    const maxTokens = Math.max(500, Math.floor(volume * 2000)); // 내용 양을 토큰 길이로 매핑

    // Generate prompts based on step
    const systemPrompt = `당신은 조선왕조실록을 기반으로 창의적인 ${theme} 동화를 만드는 스토리텔러입니다.
조선왕조실록의 역사적 사건과 인물을 바탕으로 동화의 형식으로 재구성합니다.
한국어로 작성하며, 자유도 ${freedom}의 수준에서 원문과의 거리를 조절합니다.`;

    const stepPrompts = {
      1: `다음 조선왕조실록 내용을 기반으로 "${theme}" 테마의 동화 콘셉트를 만들어주세요.
- 등장인물 소개
- 동화의 배경과 설정
- 기본 줄거리 아이디어

조선왕조실록 내용:
${silokContent}`,

      2: `이전에 생성한 콘셉트를 바탕으로 동화의 플롯 아웃라인(기승전결)을 작성해주세요.
- 기(도입): 문제 상황 설정
- 승(발전): 사건의 전개
- 전(전환): 위기와 전환점
- 결(결말): 해결과 교훈

조선왕조실록 내용:
${silokContent}`,

      3: `동화에 등장할 주요 캐릭터들의 성격, 배경, 역할을 자세히 개발해주세요.
각 캐릭터별로:
- 이름과 역할
- 성격과 특징
- 동기와 목표
- 관계도

조선왕조실록 내용:
${silokContent}`,

      4: `완성된 플롯과 캐릭터를 바탕으로 동화 본문을 작성해주세요.
- 문학적이고 창의적인 표현 사용
- 어린이도 이해할 수 있는 수준
- ${theme} 테마 반영
- 조선왕조실록의 역사적 사실 기반

조선왕조실록 내용:
${silokContent}`,

      5: `동화를 마무리하고 교훈을 담은 에필로그를 작성해주세요.
- 결말의 정리
- 역사적 배경 설명
- 어린이들이 배울 수 있는 교훈
- 마무리 인사

조선왕조실록 내용:
${silokContent}`
    };

    // Call OpenAI API
    const openaiApiKey = env.OPENAI_API_KEY;
    const defaultModel = env.OPENAI_DEFAULT_MODEL || 'gpt-4o-mini';

    if (!openaiApiKey) {
      console.error('Missing OpenAI API key');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: defaultModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: stepPrompts[step] }
        ],
        temperature,
        max_tokens: maxTokens,
      }),
    });

    if (!openaiResponse.ok) {
      const error = await openaiResponse.json();
      console.error('OpenAI error:', error);
      return new Response(
        JSON.stringify({
          error: error.error?.message || 'OpenAI API error',
        }),
        { status: openaiResponse.status, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const openaiData = await openaiResponse.json();
    const content = openaiData.choices?.[0]?.message?.content || 'No response from OpenAI';

    // Token usage
    const inputTokens = openaiData.usage?.prompt_tokens || 0;
    const outputTokens = openaiData.usage?.completion_tokens || 0;
    const totalTokens = openaiData.usage?.total_tokens || 0;

    // Calculate cost (gpt-4o-mini pricing: input $0.15/1M, output $0.60/1M)
    const costUsd = (inputTokens / 1_000_000) * 0.15 + (outputTokens / 1_000_000) * 0.60;
    const costKrw = costUsd * 1400; // USD to KRW rate

    // If fairytaleId is provided, save to Supabase
    if (fairytaleId) {
      try {
        const stepNames = ['', '콘셉트', '플롯', '캐릭터', '본문', '마무리'];

        await fetch(`${supabaseUrl}/rest/v1/fairytale_steps`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'apikey': supabaseServiceKey,
          },
          body: JSON.stringify({
            fairytale_id: fairytaleId,
            step_number: step,
            step_name: stepNames[step],
            content,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            total_tokens: totalTokens,
            cost_usd: costUsd,
          }),
        });
      } catch (error) {
        console.error('Error saving to Supabase:', error);
        // Continue anyway, don't fail the response
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        step,
        content,
        tokens: {
          input: inputTokens,
          output: outputTokens,
          total: totalTokens,
        },
        cost: {
          usd: costUsd.toFixed(6),
          krw: costKrw.toFixed(0),
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error) {
    console.error('Unhandled error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function onRequestOptions(context) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}
