/**
 * Shared pagination helper — keeps the skip/take math and the response
 * shape consistent across every module instead of each service re-deriving it.
 *
 * Usage:
 *   const { skip, take, page, limit } = getPagination(req.query);
 *   const [rows, total] = await Promise.all([
 *     prisma.model.findMany({ skip, take, ... }),
 *     prisma.model.count({ where }),
 *   ]);
 *   res.json(new ApiResponse(200, { rows, pagination: buildPaginationMeta(total, page, limit) }));
 */
const getPagination = ({ page = 1, limit = 20 } = {}) => {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
  return { skip: (pageNum - 1) * limitNum, take: limitNum, page: pageNum, limit: limitNum };
};

const buildPaginationMeta = (total, page, limit) => ({
  total,
  page: Number(page),
  limit: Number(limit),
  totalPages: Math.ceil(total / Number(limit)) || 0,
});

module.exports = { getPagination, buildPaginationMeta };
