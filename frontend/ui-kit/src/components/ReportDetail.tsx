// 報告の詳細（R3。BR2.8・BR6.1: 写真は期限付きの URL）。受け取った値は文字として表示する（NFR5.6）。
import { Box, Stack, Typography } from '@mui/material';
import { StatusChip } from './StatusChip';
import { formatDateTime, sexLabel, speciesLabel, type ReportStatus } from '../labels';

export interface ReportDetailData {
  reportId: string;
  hunterNumber?: string;
  species: string;
  sex: string;
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

export function ReportDetail({ report, status, decidedByName, decidedAt }: ReportDetailProps) {
  const body = report.photos.find((p) => p.kind === 'body');
  return (
    <Stack spacing={2}>
      {body && (
        <Box
          component="img"
          src={body.url}
          alt="全身の写真"
          data-testid="report-photo"
          sx={{ width: '100%', maxHeight: 480, objectFit: 'contain', bgcolor: '#F5F5F5' }}
        />
      )}
      <Box>
        <StatusChip status={status} />
      </Box>
      <Field label="種類" value={speciesLabel(report.species)} testId="detail-species" />
      <Field label="雌雄" value={sexLabel(report.sex)} testId="detail-sex" />
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
    </Stack>
  );
}
