import { useMemo, useState } from "react";
import { REMINDER_CONTACT_EMAIL, REMINDER_EMAIL_COLLECT_URL, REMINDER_SIGNUP_URL } from "../config";
import { normalizeText } from "../lib/normalize";

const LS_DISMISSED_UNTIL = "ucas_course_reviews__reminder_dismissed_until";
const LS_SAVED_EMAIL = "ucas_course_reviews__reminder_saved_email";

function validEmail(email: string): boolean {
  const s = normalizeText(email);
  if (!s) return false;
  // intentionally simple; avoid rejecting normal addresses
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

async function submitEmail(email: string): Promise<{ ok: boolean; message: string }> {
  const e = normalizeText(email);
  if (!validEmail(e)) return { ok: false, message: "邮箱格式不太对，再检查一下？" };

  try {
    localStorage.setItem(LS_SAVED_EMAIL, e);
  } catch {
    // ignore
  }

  const endpoint = normalizeText(REMINDER_EMAIL_COLLECT_URL);
  if (!endpoint) {
    return { ok: false, message: "本站暂未开启邮箱收集服务。" };
  }

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: e,
        createdAt: new Date().toISOString(),
        source: "ucas-course-reviews",
      }),
    });
    if (!res.ok) return { ok: false, message: `提交失败（${res.status}）。你也可以先用“下载日历提醒”兜底。` };
    return { ok: true, message: "提交成功！学期结束前后我们会提醒你回来补充评价。" };
  } catch {
    return { ok: false, message: "网络/跨域原因提交失败。你也可以先用“下载日历提醒”兜底。" };
  }
}

export function ReminderModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [msg, setMsg] = useState("");

  const signupUrl = normalizeText(REMINDER_SIGNUP_URL);
  const hasForm = Boolean(signupUrl);
  const hasApi = Boolean(normalizeText(REMINDER_EMAIL_COLLECT_URL));
  const contactEmail = normalizeText(REMINDER_CONTACT_EMAIL);
  const hasMailto = Boolean(contactEmail);

  const alreadySaved = useMemo(() => {
    try {
      return Boolean(localStorage.getItem(LS_SAVED_EMAIL));
    } catch {
      return false;
    }
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-neutral-900">学期末提醒</div>
            <div className="mt-1 text-sm text-neutral-600">如果你觉得本网站对你有帮助，欢迎留下邮箱。学期结束后我们提醒你回来补充评价。</div>
          </div>
          <button
            className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 hover:bg-neutral-50"
            onClick={onClose}
            type="button"
            aria-label="关闭"
          >
            关闭
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          {hasForm ? (
            <a
              className="block w-full rounded-xl bg-neutral-900 px-4 py-3 text-center text-sm font-medium text-white shadow-sm hover:bg-neutral-800"
              href={signupUrl}
              target="_blank"
              rel="noreferrer"
            >
              去登记邮箱
            </a>
          ) : null}

          {hasMailto ? (
            <div className={hasForm ? "mt-3" : ""}>
              <div className="text-xs text-neutral-600">或一键发邮件登记：</div>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none shadow-sm focus:border-neutral-300 focus:shadow"
                />
                <button
                  className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-neutral-800 disabled:opacity-60"
                  type="button"
                  disabled={status === "loading"}
                  onClick={async () => {
                    const e = normalizeText(email);
                    if (!validEmail(e)) {
                      setStatus("error");
                      setMsg("邮箱格式不太对，再检查一下？");
                      return;
                    }
                    try {
                      localStorage.setItem(LS_SAVED_EMAIL, e);
                    } catch {
                      // ignore
                    }

                    const subject = encodeURIComponent("【国科大课程评价】学期末提醒登记");
                    const body = encodeURIComponent(`请在学期结束后提醒我回访提交评价。\n\n我的邮箱：${e}\n`);
                    window.location.href = `mailto:${encodeURIComponent(contactEmail)}?subject=${subject}&body=${body}`;
                    setStatus("ok");
                    setMsg("已为你打开邮件草稿，发送即可完成登记。");
                  }}
                >
                  发送
                </button>
              </div>
              {msg ? (
                <div className={`mt-2 text-xs ${status === "error" ? "text-rose-700" : "text-emerald-700"}`}>{msg}</div>
              ) : alreadySaved ? (
                <div className="mt-2 text-xs text-emerald-700">你之前已经登记过了，感谢！</div>
              ) : null}
            </div>
          ) : null}

          {hasApi ? (
            <div className={hasForm || hasMailto ? "mt-3" : ""}>
              <div className="text-xs text-neutral-600">或直接在这里填写：</div>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none shadow-sm focus:border-neutral-300 focus:shadow"
                />
                <button
                  className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-neutral-800 disabled:opacity-60"
                  type="button"
                  disabled={status === "loading"}
                  onClick={async () => {
                    setStatus("loading");
                    const r = await submitEmail(email);
                    setStatus(r.ok ? "ok" : "error");
                    setMsg(r.message);
                  }}
                >
                  提交
                </button>
              </div>
              {msg ? (
                <div className={`mt-2 text-xs ${status === "error" ? "text-rose-700" : "text-emerald-700"}`}>{msg}</div>
              ) : alreadySaved ? (
                <div className="mt-2 text-xs text-emerald-700">你之前已经登记过了，感谢！</div>
              ) : null}
            </div>
          ) : null}

          {!hasForm && !hasApi && !hasMailto ? (
            <div className="text-sm text-neutral-700">本站暂未开启邮箱登记入口。</div>
          ) : (
            <div className="mt-3 text-xs text-neutral-600">我们只会在学期结束前后提醒一次，不打扰。</div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 hover:bg-neutral-50"
            type="button"
            onClick={() => {
              try {
                localStorage.setItem(LS_DISMISSED_UNTIL, String(Date.now() + 7 * 24 * 60 * 60 * 1000));
              } catch {
                // ignore
              }
              onClose();
            }}
            title="未来 7 天内不再提示"
          >
            7 天内不再提示
          </button>
          <button
            className="rounded-xl bg-neutral-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-neutral-800"
            type="button"
            onClick={onClose}
          >
            好的
          </button>
        </div>
      </div>
    </div>
  );
}


