// Return only our own messages, never the upstream body or credential details.
export async function aiError(response){
 let error;try{error=(await response.json())?.error}catch{}
 const code=typeof error?.code==='string'?error.code:'';
 const type=typeof error?.type==='string'?error.type:'';
 let message;
 if(response.status===401)message='OpenAI가 API 키를 인증하지 못했어요. 운영자가 서버에 저장한 키를 확인해야 해요.';
 else if(response.status===403||code==='model_not_found')message='이 OpenAI 프로젝트에서 요청한 모델을 사용할 권한이 없어요. 운영자가 키와 모델 권한을 확인해야 해요.';
 else if(code==='credit_balance_exhausted')message='OpenAI API 크레딧 잔액이 소진됐어요. 운영자가 OpenAI 결제 페이지에서 잔액을 확인해야 해요.';
 else if(['organization_usage_limit_exceeded','billing_hard_limit_reached','monthly_budget_exceeded','project_budget_exceeded'].includes(code))message='OpenAI API 지출 또는 사용 한도에 도달했어요. 운영자가 OpenAI Limits 설정을 확인해야 해요.';
 else if(code==='insufficient_quota'||type==='insufficient_quota')message='OpenAI API 잔액 또는 사용 한도가 부족해요. 운영자가 OpenAI Billing과 Limits를 확인해야 해요.';
 else if(response.status===429)message='OpenAI가 일시적으로 요청을 제한하고 있어요. 잠시 기다렸다가 다시 시도해 주세요.';
 else if(response.status===400)message='OpenAI가 요청 형식을 처리하지 못했어요. 녹음은 다시 시도하고, 계속되면 운영자가 설정을 확인해야 해요.';
 else if(response.status>=500)message='OpenAI 서버에 일시적인 문제가 있어요. 잠시 후 다시 시도해 주세요.';
 else message='OpenAI 요청을 완료하지 못했어요. 다시 시도하고, 계속되면 운영자에게 알려 주세요.';
 return Object.assign(new Error(message),{status:502});
}
