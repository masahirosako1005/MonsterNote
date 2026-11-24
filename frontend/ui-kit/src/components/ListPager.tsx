// 一覧のページ分けと全件数（R2・H2。BR4.4・BR4.8）。読む上限に達したときは「2,000 件以上」と表示する。
import { Box, Button, Typography } from '@mui/material';

export interface ListPagerProps {
  totalCount?: number;
  /** BR4.8: 読む上限に達し、全件数が「これ以上ある」とき */
  totalCountHasMore?: boolean;
  hasNext?: boolean;
  onNext?: () => void;
}

export function ListPager({ totalCount, totalCountHasMore, hasNext, onNext }: ListPagerProps) {
  return (
    <Box>
      {totalCount !== undefined && (
        <Typography sx={{ px: 2 }} data-testid="report-list-total">
          {totalCountHasMore ? '全 2,000 件以上' : `全 ${totalCount} 件`}
        </Typography>
      )}
      {hasNext && (
        <Button variant="outlined" fullWidth onClick={onNext} data-testid="report-list-next">
          次の 50 件
        </Button>
      )}
    </Box>
  );
}
