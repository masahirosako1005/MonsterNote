// 報告の詳細（R3・H9。BR2.8・BR6.1: 写真は期限付きの URL、BR3.14: 却下の理由）。
// 受け取った値は文字として表示する（NFR5.6）。
import { Box, Button, Stack, Typography } from '@mui/material';
import { StatusChip } from './StatusChip';
import {
  formatDateTime,
  rejectReasonLabel,
  sexLabel,
  speciesLabel,
  type ReportStatus,
} from '../labels';

const AGE_CLASS_LABELS: Record<string, string> = { adult: '成獣', juvenile: '幼獣' };
const CAPTURE_METHOD_LABELS: Record<string, string> = { trap: 'わな', gun: '銃', other: 'その他' };

export interface ReportDetailData {
  reportId: string;
  hunterNumber?: string;
  species: string;
  sex: string;
  /** U2（新規） */
  ageClass?: string;
  /** U2（新規） */
  captureMethod?: string;
  capturedAt: string;
  location: { lat: number; lng: number };
  submittedAt: string;
  photos: { photoId: string; kind: string; url: string }[];
}

export interface ReportDetailProps {
  report: ReportDetailData;
  status: ReportStatus;
  decidedByName?: string;
  decidedAt?: string;
  /** BR3.14: 却下の理由（ハンターにも見せる） */
  reason?: string;
  reasonText?: string;
  /** ハンターの詳細（H9）だけで渡す。却下のときに「撮り直して新しく報告する」を出す（AC5.2.2） */
  onRetry?: () => void;
}

function Field({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <Box>
      <Typography variant="caption" component="p">
        {label}
      </Typography>
      <Typography data-testid={testId}>{value}</Typography>
    </Box>
  );
}

const PHOTO_LABELS: Record<string, string> = {
  body: '全身の写真',
  tail: '尻尾の写真',
  chest: '胸の写真',
};

export function ReportDetail({
  report,
  status,
  decidedByName,
  decidedAt,
  reason,
  reasonText,
  onRetry,
}: ReportDetailProps) {
  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} sx={{ overflowX: 'auto' }} data-testid="report-photos">
        {report.photos.map((photo) => (
          <Box
            key={photo.photoId}
            component="img"
            src={photo.url}
            alt={PHOTO_LABELS[photo.kind] ?? photo.kind}
            data-testid="report-photo"
            sx={{
              width: '100%',
              maxWidth: 320,
              maxHeight: 480,
              objectFit: 'contain',
              bgcolor: '#F5F5F5',
            }}
          />
        ))}
      </Stack>
      <Box>
        <StatusChip status={status} />
      </Box>
      <Field label="種類" value={speciesLabel(report.species)} testId="detail-species" />
      <Field label="雌雄" value={sexLabel(report.sex)} testId="detail-sex" />
      {report.ageClass && (
        <Field
          label="成獣／幼獣"
          value={AGE_CLASS_LABELS[report.ageClass] ?? report.ageClass}
          testId="detail-age-class"
        />
      )}
      {report.captureMethod && (
        <Field
          label="捕獲の方法"
          value={CAPTURE_METHOD_LABELS[report.captureMethod] ?? report.captureMethod}
          testId="detail-capture-method"
        />
      )}
      <Field
        label="捕獲日時"
        value={formatDateTime(report.capturedAt)}
        testId="detail-captured-at"
      />
      <Field
        label="捕獲場所（緯度・経度）"
        value={`${report.location.lat.toFixed(5)}, ${report.location.lng.toFixed(5)}`}
        testId="detail-location"
      />
      {report.hunterNumber && (
        <Field label="従事者番号" value={report.hunterNumber} testId="detail-hunter-number" />
      )}
      {decidedByName && (
        <Field
          label="確認した人"
          value={`${decidedByName}（${formatDateTime(decidedAt)}）`}
          testId="detail-decided-by"
        />
      )}
      {status === 'rejected' && reason && (
        <Field
          label="却下の理由"
          value={reason === 'other' && reasonText ? reasonText : rejectReasonLabel(reason)}
          testId="detail-reject-reason"
        />
      )}
      {status === 'rejected' && onRetry && (
        <Button variant="contained" onClick={onRetry} data-testid="retry-report">
          撮り直して新しく報告する
        </Button>
      )}
    </Stack>
  );
}
