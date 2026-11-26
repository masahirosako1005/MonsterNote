// 初回の手続きの流れ（UC21。BR11.7）: パスワードの変更 → 同意（ハンターのみ）→ 従事者番号（ハンターのみ）
// の順に、GET /v1/meの印を見て必要な画面だけを出す。依頼元・管理者はパスワードの変更だけ。
import { useEffect, useState } from 'react';
import type { ApiClient } from '../api/client';
import { changePassword, getMe, registerHunterNumber, setConsent, type MeView } from '../api/me';
import { PasswordChangeForm } from './PasswordChangeForm';
import { ConsentPanel } from './ConsentPanel';
import { HunterNumberForm } from './HunterNumberForm';
import { Loading } from '../AppFrame';

export interface ProcedureFlowProps {
  api: ApiClient;
  /** すべての手続きが済んだときに呼ぶ */
  onComplete: () => void;
}

export function ProcedureFlow({ api, onComplete }: ProcedureFlowProps) {
  const [me, setMe] = useState<MeView>();
  const [error, setError] = useState<string>();

  const reload = async () => {
    try {
      setMe(await getMe(api));
    } catch {
      setError('手続きの状態を読めませんでした');
    }
  };

  useEffect(() => {
    let active = true;
    getMe(api).then(
      (result) => {
        if (active) setMe(result);
      },
      () => {
        if (active) setError('手続きの状態を読めませんでした');
      },
    );
    return () => {
      active = false;
    };
  }, [api]);

  const allDone =
    me !== undefined && !me.mustChangePassword && !me.consentRequired && !me.hunterNumberRequired;
  useEffect(() => {
    if (allDone) onComplete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone]);

  if (error) return <div role="alert">{error}</div>;
  if (!me) return <Loading />;
  if (allDone) return null;

  if (me.mustChangePassword) {
    return (
      <PasswordChangeForm
        onSubmit={async (password) => {
          await changePassword(api, password);
          await reload();
        }}
      />
    );
  }
  if (me.consentRequired) {
    return (
      <ConsentPanel
        onDecide={async (consented) => {
          await setConsent(api, consented);
          if (consented) await reload();
          // 同意しなかったときは ConsentPanel 自身が「連絡してください」の表示を続ける
        }}
      />
    );
  }
  if (me.hunterNumberRequired) {
    return (
      <HunterNumberForm
        onSubmit={async (hunterNumber) => {
          await registerHunterNumber(api, hunterNumber);
          await reload();
        }}
      />
    );
  }
  return null;
}
