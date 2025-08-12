USE [ETL_CENTER]
GO
/****** Object:  StoredProcedure [dbo].[MONITOR_ELEMENTS_HOS_DAY]    Script Date: 2025/5/29 上午 08:55:28 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
ALTER PROCEDURE [dbo].[MONITOR_ELEMENTS_HOS_DAY]
AS
BEGIN

    DECLARE @START_DATE VARCHAR(8) = CONVERT(VARCHAR, DATEADD(MONTH, DATEDIFF(MONTH, 0, GETDATE()) -1, 0), 112);
    DECLARE @END_DATE VARCHAR(8) = CONVERT(VARCHAR, EOMONTH(GETDATE(), -1) , 112);

    WITH
        MONITOR_ELEMENTS
        AS
        (
            SELECT id, hospital_code, name
            FROM EIPMONITOR.eip.dbo.monitor_elements_view
            WHERE id IN ('480', '484', '648', '106', '107', '231', '234', '275', '745')
        ),

        HOS_NUM_A
        AS
        
        (
            --當日23:59:59時正在住院
                            SELECT
                    DATESEQ,
                    IBED_DATE,
                    BED_CODE,
                    HIS_IBED_HISTORY.DEPT_CODE,
                    DEPT_TYPE,
                    DIV_CODE
                FROM HIS_IBED_HISTORY
                    INNER JOIN DEPT_TAB ON HIS_IBED_HISTORY.DEPT_CODE = DEPT_TAB.DEPT_CODE
                WHERE IBED_DATE BETWEEN @START_DATE AND @END_DATE
                    AND DATESEQ IS NOT NULL
                --確保該床位有住人

            UNION ALL

                --當日入出院
                SELECT
                    DATESEQ,
                    LEFT(START_DATE, 8) AS START_DATE,
                    BED_CODE,
                    HIS_IPATIPD.DEPT_CODE,
                    DEPT_TYPE,
                    DIV_CODE
                FROM HIS_IPATIPD
                    INNER JOIN DEPT_TAB ON HIS_IPATIPD.DEPT_CODE = DEPT_TAB.DEPT_CODE
                WHERE START_DATE BETWEEN @START_DATE + '000000' AND @END_DATE + '235959'
                    AND LEFT(START_DATE, 8) = LEFT(END_DATE, 8) --入院與入院相同日期
                    AND DSG_TYPE NOT IN ('2', '7', 'X')
            --排除以上出院別條件抓取當日入出院人次
        ),


        --同日轉換病房別
        --一般病房、加護病房、特殊病房互轉才做計算；計算轉入之護理站一筆住院人日
        --若於同一日轉換同一護理站超過一次，當日僅計算該護理站一筆住院人日。
        HOS_NUM_B
        AS
        
        (
            SELECT
                a.DATESEQ,
                CONVERT(VARCHAR(8), a.CRE_DATE, 112) AS CRE_DATE,
                a.OLD_DEPT_CODE, --轉出護理站
                d.DEPT_TYPE AS OLD_DEPT_TYPE, --轉出護理站病房類別
                a.DEPT_CODE, --轉入護理站
                a.BED_CODE, --轉入床號
                c.DEPT_TYPE, --轉入護理站病房類別
                a.DIV_CODE
            --轉入科別
            FROM HIS_IPATTRANS a
                INNER JOIN DEPT_TAB c ON a.DEPT_CODE = c.DEPT_CODE --以轉入護理站為 KEY 值，找出其病房類別
                INNER JOIN DEPT_TAB d ON a.OLD_DEPT_CODE = d.DEPT_CODE --以轉出護理站為 KEY 值，找出其病房類別
                /***同表相串，抓出同日轉換病房兩次以上***/
                INNER JOIN HIS_IPATTRANS b ON a.DATESEQ = b.DATESEQ -- 同一病人
                    AND CONVERT(VARCHAR(8), a.CRE_DATE, 112) = CONVERT(VARCHAR(8), b.CRE_DATE, 112) -- 同一天
                    AND a.DEPT_CODE = b.OLD_DEPT_CODE
            -- a 轉出病房 = b 轉入相同病房
            WHERE a.OLD_DEPT_CODE <> a.DEPT_CODE --轉換護理站
                AND b.OLD_DEPT_CODE <> b.DEPT_CODE --轉換護理站
                AND c.DEPT_TYPE <> d.DEPT_TYPE
            --轉換病房類別
        ),

        COMBINE
        AS
        
        (
            --當日23:59:59秒正在住院 + 當日入出院的病人
                            SELECT
                    DATESEQ , IBED_DATE, BED_CODE, HOS_NUM_A.DEPT_CODE, DEPT_TYPE, DIV_CODE
                FROM HOS_NUM_A

            UNION ALL

                --同日轉換病房別
                SELECT
                    DATESEQ, CRE_DATE, BED_CODE, DEPT_CODE, DEPT_TYPE, DIV_CODE
                FROM HOS_NUM_B
                WHERE DATESEQ IN (
SELECT DATESEQ
                    FROM HOS_NUM_B
                    GROUP BY DATESEQ
                    HAVING COUNT(*) > 1
) --當天必定發生兩次轉換病房，故用子查詢找出轉換兩次病房的資料
                    AND OLD_DEPT_TYPE <> DEPT_TYPE --轉換病房別
                    AND CRE_DATE BETWEEN @START_DATE AND @END_DATE
        ),

        HOS_NUM
        AS
        
        (
            SELECT
                DATESEQ , IBED_DATE, DEPT_CODE, DEPT_TYPE
            FROM COMBINE
            WHERE DEPT_CODE <> '5313'
            --現行 DEPT_CODE = 5313（護理之家）未使用，與工程師確認後計算時應予以排除。
            GROUP BY DATESEQ, IBED_DATE, DEPT_CODE, DEPT_TYPE
        ),

        --分別計算每隻指標
        Integrate
        AS
        (
            --綜合科加護病房住院人日
                                                                                                                SELECT COUNT(*) AS elements_data, 'ICU_010_2' AS CODE
                FROM HOS_NUM
                WHERE DEPT_CODE = '5330'

            UNION ALL

                --綜合科加護病房新生兒住院人日
                SELECT COUNT(*), 'ICU_027_2'
                FROM HOS_NUM
                WHERE DEPT_CODE = '5350'

            UNION ALL

                --一般病房住院人日
                SELECT COUNT(*), 'ND_003_2'
                FROM HOS_NUM
                WHERE DEPT_TYPE = '一般病房'

            UNION ALL

                --一般病房新生兒住院人日
                SELECT COUNT(*), 'ND_003_3'
                FROM HOS_NUM
                WHERE DEPT_CODE = '5353'

            UNION ALL

                --亞急性呼吸照護病房住院人日
                SELECT COUNT(*), 'ND_036_2'
                FROM HOS_NUM
                WHERE DEPT_CODE = '5315'

            UNION ALL

                --住院人日(急性一般病床+特殊病床)
                SELECT COUNT(*), 'DRA_003_02'
                FROM HOS_NUM
                WHERE DEPT_CODE IN ('5250', '5260', '5270', '5280', '5360', '5370', '5380', '5390', '5500', '5330', '5351', '5315', '5316', '5353')

            UNION ALL

                --住院人日數(持續性監測/P4P/TCPI)
                SELECT COUNT(*), 'ICC_017_01.2'
                FROM HOS_NUM
                WHERE DEPT_CODE IN ('5250', '5260', '5270', '5280', '5360', '5370', '5380', '5390', '5500', '5330', '5350', '5315', '5351', '5353')

            UNION ALL

                --住院人日數(急性一般病床)
                SELECT COUNT(*), 'DRA_003_01'
                FROM HOS_NUM
                WHERE DEPT_CODE IN ('5250', '5260', '5270', '5280', '5360', '5370', '5380', '5390', '5500')

            UNION ALL

                --住院人日數(THAS)
                SELECT COUNT(*), 'ICC_023_02'
                FROM HOS_NUM
                WHERE DEPT_CODE IN ('5250', '5260', '5270', '5280', '5360', '5370', '5380', '5390', '5500', '5330', '5315', '5316', '5351', '5353')
        )
    SELECT
        DATEADD(DAY, 1, EOMONTH(GETDATE(), -2)) AS upload_date,
        id,
        hospital_code,
        name,
        ISNULL(elements_data, 0) AS elements_data,
        GETDATE() AS cre_date
    FROM MONITOR_ELEMENTS
        LEFT JOIN Integrate ON Integrate.CODE = MONITOR_ELEMENTS.hospital_code
END;
